import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getDemoFeeFixtures } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectFeeStudents } from "./fees-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  createFinanceDemoFixture,
  parseFinanceAmountCents,
  registerFinancePayment,
  suggestNextFinancePaymentDate,
} from "./finance-demo-state.ts";

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
