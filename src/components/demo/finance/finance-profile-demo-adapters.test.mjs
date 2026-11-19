import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinancePaymentCallbackFactory } from "./finance-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceProfileCallbackFactory } from "./finance-profile-demo-adapters.ts";

const anchor = "2030-06-03";
const admin = { id: "finance-admin", role: "ADMIN" };
const teacher = { id: "finance-teacher-carlos", role: "TEACHER" };
const registration = { paidAtStr: anchor, paymentMethod: "EFECTIVO", confirmedDuplicate: false };

function harness() {
  let state = createFinanceDemoFixture(anchor);
  return {
    getState: () => state,
    commit: (next) => { state = next; },
    get state() { return state; },
  };
}

test("createFinanceProfileCallbackFactory: an ADMIN actor can run every command, and each commits only on success", async () => {
  const h = harness();
  const asAdmin = createFinanceProfileCallbackFactory({ getState: h.getState, commit: h.commit, actor: admin });

  assert.deepEqual(await asAdmin.editStudent("fee-student-juan", "Juan P."), { success: true });
  assert.equal(h.state.students.find((s) => s.id === "fee-student-juan").name, "Juan P.");

  assert.deepEqual(await asAdmin.setBlocked("fee-student-juan", true), { success: true });
  assert.equal(h.state.students.find((s) => s.id === "fee-student-juan").blocked, true);

  assert.deepEqual(await asAdmin.setPaymentExempt("fee-student-juan", true, "Becado"), { success: true });
  const exempted = h.state.students.find((s) => s.id === "fee-student-juan");
  assert.equal(exempted.paymentExempt, true);
  assert.equal(exempted.paymentExemptReason, "Becado");

  assert.deepEqual(await asAdmin.assignTeacher("fee-student-tomas", "finance-teacher-ana"), { success: true });
  assert.deepEqual(
    h.state.students.find((s) => s.id === "fee-student-tomas").assignedTeachers,
    [{ id: "finance-teacher-ana", name: "Ana Coach" }],
  );

  const stateBeforeFailure = h.state;
  assert.deepEqual(
    await asAdmin.assignTeacher("fee-student-tomas", "finance-teacher-ana"),
    { success: false, error: "Ese alumno ya está asignado a ese profe." },
  );
  assert.equal(h.state, stateBeforeFailure, "a failed command must not commit");

  assert.deepEqual(await asAdmin.unassignTeacher("fee-student-tomas", "finance-teacher-ana"), { success: true });
  assert.deepEqual(h.state.students.find((s) => s.id === "fee-student-tomas").assignedTeachers, []);
});

test("createFinanceProfileCallbackFactory: a TEACHER actor is refused for the three ADMIN-only commands and never commits", async () => {
  const h = harness();
  const asTeacher = createFinanceProfileCallbackFactory({ getState: h.getState, commit: h.commit, actor: teacher });
  const stateBefore = h.state;

  assert.deepEqual(await asTeacher.setBlocked("fee-student-juan", true), { success: false, error: "No autorizado." });
  assert.deepEqual(await asTeacher.setPaymentExempt("fee-student-juan", true, null), { success: false, error: "No autorizado." });
  assert.deepEqual(await asTeacher.assignTeacher("fee-student-tomas", "finance-teacher-ana"), { success: false, error: "No autorizado." });
  assert.equal(h.state, stateBefore, "no refused ADMIN-only command may commit");
});

/**
 * Hazard: canRecordFinancePayment (finance-demo-policy.ts) is given assignedTeacherIds derived
 * from the student that registerFinancePayment (finance-demo-state.ts) reads out of the state
 * passed to it at call time — never a value captured when a callback was built. This proves that
 * end-to-end through the exact wiring DemoFinanceProvider assembles once per mount and DemoFeesAdapter
 * / DemoCashAdapter both dispatch through: a payment callback built ONCE, before the unassignment,
 * still sees the teacher's CURRENT assignment on its second call, not the assignment as of its
 * construction. If this ever regresses to a cached/closed-over assignment snapshot, this is the
 * assertion that fails.
 */
test("hazard: unassigning a teacher immediately revokes their authorization to record a payment, even from an already-built payment callback", async () => {
  const h = harness();
  const profile = createFinanceProfileCallbackFactory({ getState: h.getState, commit: h.commit, actor: admin });
  // Built once, before any assignment change — exactly like DemoFinanceProvider builds it once per mount.
  const teacherPayment = createFinancePaymentCallbackFactory({
    getState: h.getState,
    commit: h.commit,
    actor: teacher,
    today: () => anchor,
  });

  assert.deepEqual(await profile.assignTeacher("fee-student-tomas", teacher.id), { success: true });

  const firstPayment = await teacherPayment("fee-student-tomas", "1000", "2030-07-03", registration);
  assert.equal(firstPayment.success, true, "the newly assigned teacher can record a payment");

  assert.deepEqual(await profile.unassignTeacher("fee-student-tomas", teacher.id), { success: true });

  const secondPayment = await teacherPayment("fee-student-tomas", "1000", "2030-07-10", registration);
  assert.deepEqual(secondPayment, { success: false, error: "Este alumno no está asignado a vos." });
});
