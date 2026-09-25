import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getDemoFeeFixtures } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectFeeStudents } from "./fees-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  assignFinanceStudentTeacher,
  createFinanceDemoFixture,
  editFinanceStudentName,
  parseFinanceAmountCents,
  registerFinancePayment,
  setFinanceStudentBlocked,
  setFinanceStudentPaymentExempt,
  suggestNextFinancePaymentDate,
  unassignFinanceStudentTeacher,
} from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidFinanceDemoState, serializeFinanceDemoState } from "./finance-demo-storage.ts";

const anchor = "2030-06-03";
const admin = { id: "finance-admin", role: "ADMIN" };
const teacher = { id: "finance-teacher-carlos", role: "TEACHER" };

function command(overrides = {}) {
  return {
    id: "payment-1",
    commandId: "command-1",
    actor: admin,
    studentId: "fee-student-juan",
    amountInput: "15000,50",
    paidAt: anchor,
    nextPaymentDate: "2030-07-03",
    paymentMethod: "EFECTIVO",
    confirmedDuplicate: false,
    ...overrides,
  };
}

function successful(state, overrides = {}) {
  const transition = registerFinancePayment(state, command(overrides), anchor);
  assert.equal(transition.result.success, true);
  return transition.state;
}

test("fixture construction preserves F5a active counts and date-only metadata", () => {
  const state = createFinanceDemoFixture(anchor);
  assert.equal(state.payments.length, 0);
  assert.deepEqual(
    projectFeeStudents(state.students.filter((student) => !student.deletedAt), anchor, "all", "").counts,
    { all: 7, overdue: 2, "due-soon": 2, ok: 2, exempt: 1 },
  );
  assert.deepEqual(state.students, getDemoFeeFixtures(anchor));
  assert.equal(suggestNextFinancePaymentDate("2030-01-31"), "2030-02-28");
});

test("known ADMIN and assigned TEACHER can record payments while actor claims cannot elevate scope", () => {
  let state = createFinanceDemoFixture(anchor);
  state = successful(state);
  state = successful(state, { id: "payment-2", commandId: "command-2", actor: teacher, studentId: "fee-student-camila", paidAt: "2030-06-02", nextPaymentDate: "2030-07-02" });
  assert.equal(state.payments.length, 2, "FULL and LITE/null-email students are both valid payment targets");

  for (const [label, input, expected] of [
    ["unassigned teacher", command({ actor: teacher, studentId: "fee-student-tomas" }), "Este alumno no está asignado a vos."],
    ["spoofed admin role", command({ actor: { id: teacher.id, role: "ADMIN" }, id: "payment-3", commandId: "command-3" }), "No autorizado."],
    ["unknown actor", command({ actor: { id: "outside", role: "ADMIN" }, id: "payment-4", commandId: "command-4" }), "No autorizado."],
    ["deleted student", command({ studentId: "fee-student-archived", id: "payment-5", commandId: "command-5" }), "Alumno no encontrado."],
  ]) {
    const transition = registerFinancePayment(state, input, anchor);
    assert.equal(transition.state, state, label);
    assert.deepEqual(transition.result, { success: false, error: expected }, label);
  }
});

test("exempt and blocked students warn in the view but remain valid local payment targets without profile mutation", () => {
  let state = createFinanceDemoFixture(anchor);
  const baseline = state.students.map((student) => ({ id: student.id, paymentExempt: student.paymentExempt, blocked: student.blocked }));
  state = successful(state, { id: "payment-exempt", commandId: "command-exempt", studentId: "fee-student-valentina", paidAt: "2030-06-01", nextPaymentDate: "2030-07-01" });
  state = successful(state, { id: "payment-blocked", commandId: "command-blocked", studentId: "fee-student-maria", paidAt: "2030-06-02", nextPaymentDate: "2030-07-02" });
  assert.deepEqual(
    state.students.map((student) => ({ id: student.id, paymentExempt: student.paymentExempt, blocked: student.blocked })),
    baseline,
  );
});

test("strict local amount, calendar date, and payment method validation never mutates state", () => {
  assert.equal(parseFinanceAmountCents("0,01"), 1);
  assert.equal(parseFinanceAmountCents("15000.5"), 1_500_050);
  assert.equal(parseFinanceAmountCents("9999999999.99"), 999_999_999_999);
  for (const value of ["0", "0.00", "1.234", "1,2.3", " 1", "", null, 1, Infinity, "10000000000.00"]) {
    assert.equal(parseFinanceAmountCents(value), null, String(value));
  }
  const state = createFinanceDemoFixture(anchor);
  for (const [field, value] of [
    ["amountInput", "1.234"],
    ["paidAt", "2030-02-30"],
    ["paidAt", "2030-06-04"],
    ["nextPaymentDate", "not-a-date"],
    ["paymentMethod", "CHEQUE"],
    ["paymentMethod", null],
  ]) {
    const transition = registerFinancePayment(state, command({ [field]: value }), anchor);
    assert.equal(transition.state, state, `${field}=${value}`);
    assert.equal(transition.result.success, false);
  }
});

test("duplicate confirmation is atomic, idempotent, and cannot roll a later due date backward", () => {
  let state = successful(createFinanceDemoFixture(anchor), { id: "payment-first", commandId: "command-first" });
  const duplicate = command({ id: "payment-duplicate", commandId: "command-duplicate", nextPaymentDate: "2030-08-03" });
  const unconfirmed = registerFinancePayment(state, duplicate, anchor);
  assert.equal(unconfirmed.state, state);
  assert.deepEqual(unconfirmed.result, {
    success: false,
    requiresConfirmation: true,
    duplicateInfo: { studentName: "Juan Pérez", paidAt: anchor },
  });

  state = registerFinancePayment(state, { ...duplicate, confirmedDuplicate: true }, anchor).state;
  assert.equal(state.payments.length, 2);
  const later = successful(state, {
    id: "payment-later",
    commandId: "command-later",
    paidAt: "2030-06-02",
    nextPaymentDate: "2030-09-03",
  });
  const replay = registerFinancePayment(later, { ...duplicate, confirmedDuplicate: true }, anchor);
  assert.equal(replay.state, later, "replay must not restore its historical due-date snapshot");
  assert.deepEqual(replay.result, { success: true, paymentId: "payment-duplicate", idempotent: true });
  assert.equal(replay.state.students.find((student) => student.id === "fee-student-juan")?.nextPaymentDate, "2030-09-03");

  const altered = registerFinancePayment(later, { ...duplicate, confirmedDuplicate: true, amountInput: "9" }, anchor);
  assert.equal(altered.state, later);
  assert.deepEqual(altered.result, { success: false, error: "El identificador del comando ya fue usado con otro pago." });
});

test("authorization is rechecked before an otherwise matching idempotent replay", () => {
  const state = successful(createFinanceDemoFixture(anchor));
  const replay = registerFinancePayment(state, command({ actor: { id: teacher.id, role: "ADMIN" } }), anchor);
  assert.equal(replay.state, state);
  assert.deepEqual(replay.result, { success: false, error: "No autorizado." });
});

function studentById(state, id) {
  return state.students.find((student) => student.id === id);
}

function withoutFields(student, ...fields) {
  const clone = { ...student };
  for (const field of fields) delete clone[field];
  return clone;
}

test("editFinanceStudentName: ADMIN or the assigned TEACHER renames a student, changing only the name", () => {
  const state = createFinanceDemoFixture(anchor);
  const before = studentById(state, "fee-student-juan");

  const byAdmin = editFinanceStudentName(state, { actor: admin, studentId: "fee-student-juan", name: "  Juan P.  " });
  assert.equal(byAdmin.result.success, true);
  const afterAdmin = studentById(byAdmin.state, "fee-student-juan");
  assert.equal(afterAdmin.name, "Juan P.");
  assert.deepEqual(withoutFields(afterAdmin, "name"), withoutFields(before, "name"));

  const byTeacher = editFinanceStudentName(state, { actor: teacher, studentId: "fee-student-juan", name: "Juan T." });
  assert.equal(byTeacher.result.success, true);
  assert.equal(studentById(byTeacher.state, "fee-student-juan").name, "Juan T.");
});

test("editFinanceStudentName: a TEACHER not assigned to the student is refused, and a blank name is rejected", () => {
  const state = createFinanceDemoFixture(anchor);
  const unassigned = editFinanceStudentName(state, { actor: teacher, studentId: "fee-student-tomas", name: "Tomás T." });
  assert.equal(unassigned.state, state);
  assert.deepEqual(unassigned.result, { success: false, error: "Este alumno no está asignado a vos." });

  const blank = editFinanceStudentName(state, { actor: admin, studentId: "fee-student-juan", name: "   " });
  assert.equal(blank.state, state);
  assert.equal(blank.result.success, false);
});

test("setFinanceStudentBlocked: ADMIN toggles blocked, changing only that field; a TEACHER is refused", () => {
  const state = createFinanceDemoFixture(anchor);
  const before = studentById(state, "fee-student-juan");
  assert.equal(before.blocked, false);

  const blocked = setFinanceStudentBlocked(state, { actor: admin, studentId: "fee-student-juan", blocked: true });
  assert.equal(blocked.result.success, true);
  const after = studentById(blocked.state, "fee-student-juan");
  assert.equal(after.blocked, true);
  assert.deepEqual(withoutFields(after, "blocked"), withoutFields(before, "blocked"));

  const unblocked = setFinanceStudentBlocked(blocked.state, { actor: admin, studentId: "fee-student-juan", blocked: false });
  assert.equal(studentById(unblocked.state, "fee-student-juan").blocked, false);

  const refused = setFinanceStudentBlocked(state, { actor: teacher, studentId: "fee-student-juan", blocked: true });
  assert.equal(refused.state, state);
  assert.deepEqual(refused.result, { success: false, error: "No autorizado." });
});

test("setFinanceStudentPaymentExempt: ADMIN toggles exemption and normalizes a blank reason to null; a TEACHER is refused", () => {
  const state = createFinanceDemoFixture(anchor);
  const before = studentById(state, "fee-student-juan");

  const exempted = setFinanceStudentPaymentExempt(state, { actor: admin, studentId: "fee-student-juan", exempt: true, reason: "  Becado  " });
  assert.equal(exempted.result.success, true);
  const after = studentById(exempted.state, "fee-student-juan");
  assert.equal(after.paymentExempt, true);
  assert.equal(after.paymentExemptReason, "Becado");
  assert.deepEqual(withoutFields(after, "paymentExempt", "paymentExemptReason"), withoutFields(before, "paymentExempt", "paymentExemptReason"));

  const cleared = setFinanceStudentPaymentExempt(exempted.state, { actor: admin, studentId: "fee-student-juan", exempt: false, reason: "   " });
  assert.equal(cleared.result.success, true);
  const afterClear = studentById(cleared.state, "fee-student-juan");
  assert.equal(afterClear.paymentExempt, false);
  assert.equal(afterClear.paymentExemptReason, null);

  const refused = setFinanceStudentPaymentExempt(state, { actor: teacher, studentId: "fee-student-juan", exempt: true, reason: null });
  assert.equal(refused.state, state);
  assert.deepEqual(refused.result, { success: false, error: "No autorizado." });
});

test("assign/unassignFinanceStudentTeacher: ADMIN manages assignment from the fixed BOX teacher roster; a TEACHER is refused", () => {
  const state = createFinanceDemoFixture(anchor);
  const before = studentById(state, "fee-student-tomas");
  assert.deepEqual(before.assignedTeachers, []);

  const assigned = assignFinanceStudentTeacher(state, { actor: admin, studentId: "fee-student-tomas", teacherId: teacher.id });
  assert.equal(assigned.result.success, true);
  const afterAssign = studentById(assigned.state, "fee-student-tomas");
  assert.deepEqual(afterAssign.assignedTeachers, [{ id: teacher.id, name: "Carlos Entrenador" }]);
  assert.deepEqual(withoutFields(afterAssign, "assignedTeachers"), withoutFields(before, "assignedTeachers"));

  const duplicate = assignFinanceStudentTeacher(assigned.state, { actor: admin, studentId: "fee-student-tomas", teacherId: teacher.id });
  assert.deepEqual(duplicate.result, { success: false, error: "Ese alumno ya está asignado a ese profe." });

  const unknownTeacher = assignFinanceStudentTeacher(state, { actor: admin, studentId: "fee-student-tomas", teacherId: "finance-admin" });
  assert.deepEqual(unknownTeacher.result, { success: false, error: "El profe no existe." });

  const refusedAssign = assignFinanceStudentTeacher(state, { actor: teacher, studentId: "fee-student-tomas", teacherId: teacher.id });
  assert.deepEqual(refusedAssign.result, { success: false, error: "No autorizado." });

  const unassigned = unassignFinanceStudentTeacher(assigned.state, { actor: admin, studentId: "fee-student-tomas", teacherId: teacher.id });
  assert.equal(unassigned.result.success, true);
  assert.deepEqual(studentById(unassigned.state, "fee-student-tomas").assignedTeachers, []);

  const missingLink = unassignFinanceStudentTeacher(state, { actor: admin, studentId: "fee-student-tomas", teacherId: teacher.id });
  assert.deepEqual(missingLink.result, { success: false, error: "La asignación no existe." });

  const refusedUnassign = unassignFinanceStudentTeacher(assigned.state, { actor: teacher, studentId: "fee-student-tomas", teacherId: teacher.id });
  assert.deepEqual(refusedUnassign.result, { success: false, error: "No autorizado." });
});

test("every profile command's resulting state survives a persist/restore round trip", () => {
  const state = createFinanceDemoFixture(anchor);
  const mutated = [
    editFinanceStudentName(state, { actor: admin, studentId: "fee-student-juan", name: "Juan P." }).state,
    setFinanceStudentBlocked(state, { actor: admin, studentId: "fee-student-juan", blocked: true }).state,
    setFinanceStudentPaymentExempt(state, { actor: admin, studentId: "fee-student-juan", exempt: true, reason: "Becado" }).state,
    assignFinanceStudentTeacher(state, { actor: admin, studentId: "fee-student-tomas", teacherId: teacher.id }).state,
  ];
  for (const next of mutated) {
    assert.equal(isValidFinanceDemoState(next), true);
    assert.deepEqual(JSON.parse(serializeFinanceDemoState(next)), next);
  }

  const assignedThenUnassigned = unassignFinanceStudentTeacher(
    assignFinanceStudentTeacher(state, { actor: admin, studentId: "fee-student-tomas", teacherId: teacher.id }).state,
    { actor: admin, studentId: "fee-student-tomas", teacherId: teacher.id },
  ).state;
  assert.equal(isValidFinanceDemoState(assignedThenUnassigned), true);
  assert.deepEqual(JSON.parse(serializeFinanceDemoState(assignedThenUnassigned)), assignedThenUnassigned);
});
