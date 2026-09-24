import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  getGymDemoActorToken,
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
} from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  projectGymFinanceFeesData,
  projectGymFinancePaymentStudentSelection,
} from "./gym-finance-demo-projection.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const tomas = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const nora = getGymDemoActorToken(GYM_DEMO_SECONDARY_TEACHER_ID);
const NO_AUTHORIZATION = { success: false, error: "No autorizado." };
const INVALID_STATE = { success: false, error: "El estado financiero no es válido." };

function fixture() {
  return createGymFinanceDemoFixture(anchor);
}

function payment(state, id, studentId, amountInput, paidAt, nextPaymentDate, confirmedDuplicate = false) {
  return registerFinancePayment(state, {
    id,
    commandId: `${id}-command`,
    actor: admin,
    studentId,
    amountInput,
    paidAt,
    nextPaymentDate,
    paymentMethod: "EFECTIVO",
    confirmedDuplicate,
  }, anchor);
}

function ids(result) {
  assert.equal(result.success, true);
  return result.rows.map((row) => row.id);
}

test("canonical GYM tokens project exact directory scopes for admin and both teachers", () => {
  const state = fixture();
  assert.deepEqual(ids(projectGymFinanceFeesData(state, admin, anchor)), [
    "gym-fixed-student-general",
    "gym-fixed-student-personalized",
    "gym-fixed-student-personalized-unlinked",
    "gym-fixed-student-muslib",
    "gym-fixed-student-muslib-lite",
  ]);
  assert.deepEqual(ids(projectGymFinanceFeesData(state, tomas, anchor)), [
    "gym-fixed-student-general",
    "gym-fixed-student-personalized",
    "gym-fixed-student-muslib",
    "gym-fixed-student-muslib-lite",
  ]);
  assert.deepEqual(ids(projectGymFinanceFeesData(state, nora, anchor)), []);

  const paymentStudents = projectGymFinancePaymentStudentSelection(state, tomas);
  assert.equal(paymentStudents.success, true);
  assert.deepEqual(paymentStudents.students.map((student) => student.id), [
    "gym-fixed-student-general",
    "gym-fixed-student-personalized",
    "gym-fixed-student-muslib",
    "gym-fixed-student-muslib-lite",
  ]);
});

test("unknown, copied, proxied, BOX-shaped, student, and LITE identities are denied before state or input reads", () => {
  const copied = {};
  const proxied = new Proxy({}, { get() { throw new Error("token getter"); } });
  const hostileDate = Object.defineProperty({}, "valueOf", { get() { throw new Error("date getter"); } });
  const invalidTokens = [
    null,
    copied,
    proxied,
    { id: "finance-admin", role: "ADMIN", gymKind: "BOX" },
    { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" },
    getGymDemoActorToken("gym-fixed-student-general"),
    getGymDemoActorToken("gym-fixed-student-muslib-lite"),
  ];
  for (const token of invalidTokens) {
    let stateReads = 0;
    const state = new Proxy({}, {
      get() { stateReads += 1; throw new Error("state getter"); },
      ownKeys() { stateReads += 1; throw new Error("state keys"); },
      getOwnPropertyDescriptor() { stateReads += 1; throw new Error("state descriptor"); },
    });
    assert.deepEqual(projectGymFinanceFeesData(state, token, hostileDate), NO_AUTHORIZATION);
    assert.deepEqual(projectGymFinancePaymentStudentSelection(state, token), NO_AUTHORIZATION);
    assert.equal(stateReads, 0);
  }
});

test("foreign namespace is rejected before children, while the validator takes exactly one two-key root capture", () => {
  const base = fixture();
  let childReads = 0;
  const foreign = {
    ...base,
    namespace: "wody-box-finance-demo",
    students: new Proxy(base.students, {
      get() { childReads += 1; throw new Error("foreign child"); },
      ownKeys() { childReads += 1; throw new Error("foreign child keys"); },
    }),
  };
  assert.deepEqual(projectGymFinanceFeesData(foreign, admin, anchor), INVALID_STATE);
  assert.deepEqual(projectGymFinancePaymentStudentSelection(foreign, admin), INVALID_STATE);
  assert.equal(childReads, 0);

  let rootKeys = 0;
  let sourceGets = 0;
  let toJSONGets = 0;
  const hostile = new Proxy(base, {
    get(target, key, receiver) {
      sourceGets += 1;
      if (key === "toJSON") toJSONGets += 1;
      return Reflect.get(target, key, receiver);
    },
    ownKeys(target) {
      rootKeys += 1;
      if (rootKeys > 2) throw new Error("third root capture");
      return Reflect.ownKeys(target);
    },
  });
  const result = projectGymFinanceFeesData(hostile, admin, anchor);
  assert.equal(result.success, true);
  assert.equal(rootKeys, 2);
  assert.equal(sourceGets, 0);
  assert.equal(toJSONGets, 0);
});

test("invalid ledgers fail explicitly, while valid empty history and an empty teacher scope succeed", () => {
  const invalid = { ...fixture(), payments: [{ id: "bad" }] };
  assert.deepEqual(projectGymFinanceFeesData(invalid, admin, anchor), INVALID_STATE);
  assert.deepEqual(projectGymFinancePaymentStudentSelection(invalid, admin), INVALID_STATE);

  const empty = projectGymFinancePaymentStudentSelection(fixture(), admin);
  assert.equal(empty.success, true);
  assert.ok(empty.students.every((student) => student.lastAmount === null));
  const teacherEmpty = projectGymFinancePaymentStudentSelection(fixture(), nora);
  assert.deepEqual(teacherEmpty, { success: true, students: [] });
});

test("payment selection uses reducer history, cents display conversion, latest-date and later tie precedence", () => {
  let state = fixture();
  let recorded = payment(state, "payment-one", "gym-fixed-student-general", "1200", "2030-06-02", "2030-07-02");
  assert.equal(recorded.result.success, true);
  state = recorded.state;
  recorded = payment(state, "payment-two", "gym-fixed-student-general", "1234.56", "2030-06-03", "2030-07-03");
  assert.equal(recorded.result.success, true);
  state = recorded.state;
  recorded = payment(state, "payment-three", "gym-fixed-student-general", "88", "2030-06-03", "2030-07-03", true);
  assert.equal(recorded.result.success, true);
  state = recorded.state;

  const projection = projectGymFinancePaymentStudentSelection(state, admin);
  assert.equal(projection.success, true);
  const paula = projection.students.find((student) => student.id === "gym-fixed-student-general");
  assert.deepEqual(paula, {
    id: "gym-fixed-student-general",
    name: "Paula Méndez",
    suggestedNextDate: "2030-08-03",
    lastAmount: 88,
    paymentExempt: false,
    paymentExemptReason: null,
  });
  assert.deepEqual(state.payments.map((entry) => entry.id), ["payment-one", "payment-two", "payment-three"]);
});

test("the shared Cuotas date contract and renewal helper retain UTC boundaries and month clamping", () => {
  const boundary = projectGymFinanceFeesData(fixture(), admin, anchor);
  assert.equal(boundary.success, true);
  assert.deepEqual(boundary.rows.find((row) => row.id === "gym-fixed-student-general")?.status, { kind: "overdue", days: 12 });
  assert.deepEqual(boundary.rows.find((row) => row.id === "gym-fixed-student-personalized")?.status, { kind: "due-soon", days: 3 });

  const state = fixture();
  state.students[0].nextPaymentDate = "2030-01-31";
  const selection = projectGymFinancePaymentStudentSelection(state, admin);
  assert.equal(selection.success, true);
  assert.equal(selection.students[0].suggestedNextDate, "2030-02-28");
});

test("archived history remains valid but archived students are hidden; LITE and payment flags retain their view DTO values", () => {
  const state = fixture();
  state.payments.push({
    id: "archived-history",
    commandId: "archived-history-command",
    studentId: "gym-fixed-student-muslib-archived",
    amountCents: 9_999,
    paidAt: anchor,
    nextPaymentDate: "2030-07-03",
    paymentMethod: "EFECTIVO",
    recordedById: GYM_DEMO_ADMIN_ID,
  });
  const fees = projectGymFinanceFeesData(state, tomas, anchor);
  const picker = projectGymFinancePaymentStudentSelection(state, admin);
  assert.equal(fees.success, true);
  assert.equal(picker.success, true);
  assert.equal(fees.rows.some((row) => row.id === "gym-fixed-student-muslib-archived"), false);
  assert.equal(picker.students.some((student) => student.id === "gym-fixed-student-muslib-archived"), false);
  const lite = fees.rows.find((row) => row.id === "gym-fixed-student-muslib-lite");
  assert.deepEqual({ email: lite?.email, accountKind: lite?.accountKind }, { email: null, accountKind: "LITE" });
  const exempt = picker.students.find((student) => student.id === "gym-fixed-student-muslib");
  assert.deepEqual({ exempt: exempt?.paymentExempt, reason: exempt?.paymentExemptReason }, { exempt: true, reason: "Beca de demostración" });
  const blocked = fees.rows.find((row) => row.id === "gym-fixed-student-personalized");
  assert.deepEqual(blocked?.blockStatus, { blocked: true, kind: "manual" });
});

test("DTOs are detached, fresh per call, and invalid foreign student IDs are rejected instead of silently repaired", () => {
  const state = fixture();
  const first = projectGymFinanceFeesData(state, admin, anchor);
  assert.equal(first.success, true);
  first.rows[0].name = "Mutated";
  first.rows[0].assignedTeachers.push({ id: "other", name: "Other" });
  assert.notEqual(state.students[0].name, "Mutated");
  assert.equal(state.students[0].assignedTeachers.some((teacher) => teacher.id === "other"), false);
  const second = projectGymFinanceFeesData(state, admin, anchor);
  assert.equal(second.success, true);
  assert.equal(second.rows[0].name, "Paula Méndez");
  assert.equal(second.rows[0].assignedTeachers.some((teacher) => teacher.id === "other"), false);

  const changed = fixture();
  changed.students[0].nextPaymentDate = "2030-06-20";
  const changedProjection = projectGymFinanceFeesData(changed, admin, anchor);
  assert.equal(changedProjection.success, true);
  assert.deepEqual(changedProjection.rows[0].status, { kind: "ok", days: 17 });

  const foreignStudent = fixture();
  foreignStudent.students[0].id = "foreign-student";
  assert.deepEqual(projectGymFinanceFeesData(foreignStudent, admin, anchor), INVALID_STATE);
  const foreignPayment = fixture();
  foreignPayment.payments.push({
    id: "foreign-payment",
    commandId: "foreign-payment-command",
    studentId: "foreign-student",
    amountCents: 100,
    paidAt: anchor,
    nextPaymentDate: "2030-07-03",
    paymentMethod: "EFECTIVO",
    recordedById: GYM_DEMO_ADMIN_ID,
  });
  assert.deepEqual(projectGymFinancePaymentStudentSelection(foreignPayment, admin), INVALID_STATE);
});
