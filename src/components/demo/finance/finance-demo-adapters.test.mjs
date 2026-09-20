import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinancePaymentCallbackFactory, projectFinancePaymentStudents } from "./finance-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";

const anchor = "2030-06-03";
const registration = {
  paidAtStr: anchor,
  paymentMethod: "EFECTIVO",
  confirmedDuplicate: false,
};

function confirmationError() {
  return { success: false, error: "La confirmación de pago ya no es válida." };
}

test("callback factory reads latest state, commits only success, and retains its local command ID for duplicate confirmation", async () => {
  let state = createFinanceDemoFixture(anchor);
  const ids = [];
  const callback = createFinancePaymentCallbackFactory({
    getState: () => state,
    commit: (next) => { state = next; },
    actor: { id: "finance-admin", role: "ADMIN" },
    today: () => anchor,
    nextId: (kind) => {
      const id = `${kind}-${ids.length + 1}`;
      ids.push(id);
      return id;
    },
  });

  assert.deepEqual(
    await callback("fee-student-juan", "15000,50", "2030-07-03", registration),
    { success: true, paymentId: "payment-2", idempotent: false },
  );
  const afterFirst = state;
  const duplicate = await callback("fee-student-juan", "15000,50", "2030-08-03", registration);
  assert.deepEqual(duplicate, {
    success: false,
    requiresConfirmation: true,
    duplicateInfo: { studentName: "Juan Pérez", paidAt: anchor },
  });
  assert.equal(state, afterFirst, "a duplicate prompt never commits a partial due-date update");

  const confirmed = await callback("fee-student-juan", "15000,50", "2030-08-03", { ...registration, confirmedDuplicate: true });
  assert.equal(confirmed.success, true);
  assert.equal(state.payments.length, 2);
  assert.equal(state.payments[1].commandId, "command-3", "confirmation reuses the local duplicate command id");
  assert.equal(state.students.find((student) => student.id === "fee-student-juan")?.nextPaymentDate, "2030-08-03");
});

test("confirmation binds exactly one pending duplicate, supports exact replay, and never upgrades stale input", async () => {
  let state = createFinanceDemoFixture(anchor);
  const actor = { id: "finance-admin", role: "ADMIN" };
  let serial = 0;
  const callback = createFinancePaymentCallbackFactory({
    getState: () => state,
    commit: (next) => { state = next; },
    actor,
    today: () => anchor,
    nextId: (kind) => `${kind}-${++serial}`,
  });
  const first = await callback("fee-student-juan", "100", "2030-07-03", registration);
  assert.equal(first.success, true);
  const beforePrompts = state;
  const promptAInput = ["fee-student-juan", "101", "2030-08-03"];
  const promptA = await callback(...promptAInput, registration);
  assert.equal("requiresConfirmation" in promptA, true);
  assert.equal(state, beforePrompts);

  assert.deepEqual(await callback(...promptAInput, { ...registration, confirmedDuplicate: true, paymentMethod: "TARJETA" }), confirmationError(), "method changes cannot consume prompt A");
  assert.deepEqual(await callback("fee-student-juan", "102", "2030-08-03", { ...registration, confirmedDuplicate: true }), confirmationError(), "amount changes cannot consume prompt A");
  assert.deepEqual(await callback("fee-student-juan", "101", "2030-08-04", { ...registration, confirmedDuplicate: true }), confirmationError(), "date changes cannot consume prompt A");
  actor.role = "TEACHER";
  assert.deepEqual(await callback(...promptAInput, { ...registration, confirmedDuplicate: true }), confirmationError(), "actor changes cannot consume prompt A");
  actor.role = "ADMIN";
  assert.equal((await callback(...promptAInput, { ...registration, confirmedDuplicate: true })).success, true, "a rejected altered confirmation leaves its exact prompt usable");
  assert.equal(state.payments.length, 2);
  assert.deepEqual(
    await callback(...promptAInput, { ...registration, confirmedDuplicate: true }),
    { success: true, paymentId: state.payments[1].id, idempotent: true },
    "the exact completed confirmation replays its original command",
  );

  const promptBInput = ["fee-student-juan", "103", "2030-09-03"];
  const promptB = await callback(...promptBInput, registration);
  assert.equal("requiresConfirmation" in promptB, true, "a new unconfirmed submission clears the old replay and opens a new prompt");
  assert.deepEqual(await callback(...promptAInput, { ...registration, confirmedDuplicate: true }), confirmationError(), "stale confirmation A cannot consume replacement prompt B");
  callback.cancelPendingDuplicate();
  assert.deepEqual(await callback(...promptBInput, { ...registration, confirmedDuplicate: true }), confirmationError(), "explicit cancellation invalidates the pending prompt");

  const promptC = await callback(...promptBInput, registration);
  assert.equal("requiresConfirmation" in promptC, true);
  const confirmedC = await callback(...promptBInput, { ...registration, confirmedDuplicate: true });
  assert.equal(confirmedC.success, true);
  assert.equal(state.payments.length, 3, "a separate identical unconfirmed submission receives fresh command identity");
});

test("direct confirmation without a pending prompt is immutable and cannot bypass the duplicate guard", async () => {
  let state = createFinanceDemoFixture(anchor);
  const callback = createFinancePaymentCallbackFactory({
    getState: () => state,
    commit: (next) => { state = next; },
    actor: { id: "finance-admin", role: "ADMIN" },
    today: () => anchor,
  });
  assert.equal((await callback("fee-student-juan", "100", "2030-07-03", registration)).success, true);
  const beforeDirectConfirmation = state;
  assert.deepEqual(
    await callback("fee-student-juan", "100", "2030-08-03", { ...registration, confirmedDuplicate: true }),
    confirmationError(),
  );
  assert.equal(state, beforeDirectConfirmation);
  assert.equal(state.payments.length, 1);
});

test("default factory reserves cancelled and replaced IDs for its lifetime while a new factory avoids persisted IDs", async () => {
  let state = createFinanceDemoFixture(anchor);
  const makeFactory = () => createFinancePaymentCallbackFactory({
    getState: () => state,
    commit: (next) => { state = next; },
    actor: { id: "finance-admin", role: "ADMIN" },
    today: () => anchor,
  });
  const callback = makeFactory();
  assert.deepEqual(
    await callback("fee-student-juan", "100", "2030-07-03", registration),
    { success: true, paymentId: "finance-payment-local-1", idempotent: false },
  );

  const duplicateInput = ["fee-student-juan", "101", "2030-08-03"];
  assert.equal("requiresConfirmation" in await callback(...duplicateInput, registration), true, "the cancelled prompt reserves payment/command local-2");
  callback.cancelPendingDuplicate();
  assert.equal("requiresConfirmation" in await callback(...duplicateInput, registration), true, "the fresh post-cancel prompt must reserve local-3");
  assert.deepEqual(
    await callback(...duplicateInput, { ...registration, confirmedDuplicate: true }),
    { success: true, paymentId: "finance-payment-local-3", idempotent: false },
  );
  assert.equal(state.payments[1].commandId, "finance-command-local-3", "cancelled command local-2 was not reused");
  assert.deepEqual(
    await callback(...duplicateInput, { ...registration, confirmedDuplicate: true }),
    { success: true, paymentId: "finance-payment-local-3", idempotent: true },
    "exact confirmation replay retains its reservation",
  );

  const replacementInput = ["fee-student-juan", "102", "2030-09-03"];
  assert.equal("requiresConfirmation" in await callback(...replacementInput, registration), true, "replacement prompt reserves local-4");
  assert.equal("requiresConfirmation" in await callback(...replacementInput, registration), true, "fresh replacement submission reserves local-5");
  assert.deepEqual(
    await callback(...replacementInput, { ...registration, confirmedDuplicate: true }),
    { success: true, paymentId: "finance-payment-local-5", idempotent: false },
  );
  assert.equal(state.payments[2].commandId, "finance-command-local-5");

  const reloadedFactory = makeFactory();
  assert.equal("requiresConfirmation" in await reloadedFactory(...replacementInput, registration), true);
  assert.deepEqual(
    await reloadedFactory(...replacementInput, { ...registration, confirmedDuplicate: true }),
    { success: true, paymentId: "finance-payment-local-2", idempotent: false },
    "a new factory may reuse cancelled-only local-2 but never a persisted local-1/3/5 id",
  );
  assert.equal(state.payments[3].commandId, "finance-command-local-2");
});

test("view projection preserves the real dialog's last-amount and next-date suggestions at the presentation edge", async () => {
  let state = createFinanceDemoFixture(anchor);
  const callback = createFinancePaymentCallbackFactory({
    getState: () => state,
    commit: (next) => { state = next; },
    actor: { id: "finance-admin", role: "ADMIN" },
    today: () => anchor,
  });
  await callback("fee-student-camila", "1234,56", "2030-07-10", { ...registration, paidAtStr: "2030-06-02", paymentMethod: "MERCADO_PAGO" });
  const camila = projectFinancePaymentStudents(state).find((student) => student.id === "fee-student-camila");
  assert.deepEqual(
    { lastAmount: camila?.lastAmount, suggestedNextDate: camila?.suggestedNextDate },
    { lastAmount: 1234.56, suggestedNextDate: "2030-08-10" },
  );
  assert.equal(projectFinancePaymentStudents(state).some((student) => student.id === "fee-student-archived"), false);
});

test("factory rejects spoofed actor claims without committing and carries no actor in local state", async () => {
  let state = createFinanceDemoFixture(anchor);
  const callback = createFinancePaymentCallbackFactory({
    getState: () => state,
    commit: (next) => { state = next; },
    actor: { id: "finance-teacher-carlos", role: "ADMIN" },
    today: () => anchor,
  });
  assert.deepEqual(
    await callback("fee-student-juan", "100", "2030-07-03", registration),
    { success: false, error: "No autorizado." },
  );
  assert.equal(state.payments.length, 0);
  assert.equal("actor" in state, false);
});
