import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken, GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinancePaymentCallbackFactory } from "./gym-finance-payment-adapters.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const teacher = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const unassignedTeacher = getGymDemoActorToken(GYM_DEMO_SECONDARY_TEACHER_ID);
const registration = { paidAtStr: anchor, paymentMethod: "EFECTIVO", confirmedDuplicate: false };
const confirmationError = { success: false, error: "La confirmación de pago ya no es válida." };

function fixture(overrides = {}) {
  let state = createGymFinanceDemoFixture(anchor);
  const commits = [];
  const callback = createGymFinancePaymentCallbackFactory({
    gymActorToken: admin,
    getState: () => state,
    commit: (next) => { state = next; commits.push(next); },
    ...overrides,
  });
  return { callback, commits, get state() { return state; }, set state(value) { state = value; } };
}

function pay(callback, studentId = "gym-fixed-student-general", amount = "1234,56", nextDate = "2030-07-03", options = registration) {
  return callback(studentId, amount, nextDate, options);
}

test("GYM staff callbacks preserve actual payment reducer authorization, student eligibility, dates, methods, cents and exemption behavior", async () => {
  const adminDemo = fixture();
  assert.deepEqual(await pay(adminDemo.callback), { success: true, paymentId: "gym-finance-payment-local-1", idempotent: false });
  assert.equal(adminDemo.commits.length, 1);
  assert.equal(adminDemo.state.payments[0].amountCents, 123_456);

  const teacherDemo = fixture({ gymActorToken: teacher });
  assert.equal((await pay(teacherDemo.callback)).success, true, "assigned teacher may record payment");
  assert.deepEqual(await pay(teacherDemo.callback, "gym-fixed-student-personalized-unlinked"), { success: false, error: "Este alumno no está asignado a vos." });
  assert.deepEqual(await pay(teacherDemo.callback, "gym-fixed-student-muslib-archived"), { success: false, error: "Alumno no encontrado." });
  assert.deepEqual(await pay(teacherDemo.callback, "gym-fixed-student-muslib", "120", "2030-07-03", { ...registration, paymentMethod: "MERCADO_PAGO" }), { success: true, paymentId: "gym-finance-payment-local-2", idempotent: false }, "exemption remains reducer-owned, not a callback rejection");
  assert.deepEqual(await pay(teacherDemo.callback, "gym-fixed-student-general", "1,234", "2030-07-03"), { success: false, error: "El pago no es válido." });
  assert.deepEqual(await pay(teacherDemo.callback, "gym-fixed-student-general", "10", "2030-07-03", { ...registration, paidAtStr: "2030-02-30" }), { success: false, error: "El pago no es válido." });
  assert.deepEqual(await pay(teacherDemo.callback, "gym-fixed-student-general", "10", "2030-07-03", { ...registration, paymentMethod: "CHEQUE" }), { success: false, error: "El pago no es válido." });

  const unassigned = fixture({ gymActorToken: unassignedTeacher });
  assert.deepEqual(await pay(unassigned.callback), { success: false, error: "Este alumno no está asignado a vos." });
});

test("duplicate challenge, exact confirmation replay, replacement and cancellation bind only one payment identity", async () => {
  const demo = fixture();
  assert.equal((await pay(demo.callback)).success, true);
  const duplicate = await pay(demo.callback, undefined, "100", "2030-08-03");
  assert.equal("requiresConfirmation" in duplicate, true);
  assert.deepEqual(await pay(demo.callback, undefined, "101", "2030-08-03", { ...registration, confirmedDuplicate: true }), confirmationError);
  assert.equal((await pay(demo.callback, undefined, "100", "2030-08-03", { ...registration, confirmedDuplicate: true })).success, true);
  const afterConfirmation = demo.state;
  assert.deepEqual(await pay(demo.callback, undefined, "100", "2030-08-03", { ...registration, confirmedDuplicate: true }), { success: true, paymentId: "gym-finance-payment-local-2", idempotent: true });
  assert.equal(demo.state, afterConfirmation, "idempotent confirmation does not commit a second due/history update");

  assert.equal("requiresConfirmation" in await pay(demo.callback, undefined, "101", "2030-09-03"), true);
  assert.equal("requiresConfirmation" in await pay(demo.callback, undefined, "102", "2030-09-03"), true, "new unconfirmed input replaces the earlier challenge");
  assert.deepEqual(await pay(demo.callback, undefined, "101", "2030-09-03", { ...registration, confirmedDuplicate: true }), confirmationError);
  demo.callback.cancelPendingDuplicate();
  assert.deepEqual(await pay(demo.callback, undefined, "102", "2030-09-03", { ...registration, confirmedDuplicate: true }), confirmationError);
  assert.equal("requiresConfirmation" in await pay(demo.callback, undefined, "102", "2030-09-03"), true);
  assert.equal((await pay(demo.callback, undefined, "102", "2030-09-03", { ...registration, confirmedDuplicate: true })).success, true);
});

test("queued operations coalesce only exact work, read fresh state once, remain reusable after settlement, and cancellation cannot clear newer work", async () => {
  let reads = 0;
  const demo = fixture({ getState: () => { reads += 1; return demo.state; } });
  const first = pay(demo.callback);
  const same = pay(demo.callback);
  const different = pay(demo.callback, undefined, "99");
  assert.equal(first, same);
  assert.equal(reads, 0, "state is deferred to the queue boundary");
  assert.deepEqual(await different, { success: false, error: "Hay un pago en curso. Esperá un momento." });
  assert.equal((await first).success, true);
  assert.equal(reads, 1);
  assert.equal("requiresConfirmation" in await pay(demo.callback), true, "settled work is not cached forever");

  const reset = fixture();
  const old = pay(reset.callback);
  reset.callback.cancelPending();
  const fresh = pay(reset.callback, undefined, "55");
  assert.deepEqual(await old, { success: false, error: "El pago fue restablecido antes de registrarse." });
  assert.equal((await fresh).success, true, "old cleanup cannot erase the newer pending operation");
});

test("both cancellation APIs invalidate queued submissions and duplicate/replay bindings before execution", async () => {
  for (const cancellation of ["cancelPending", "cancelPendingDuplicate"]) {
    let reads = 0;
    const demo = fixture({ getState: () => { reads += 1; return demo.state; } });
    const queued = pay(demo.callback);
    demo.callback[cancellation]();
    assert.deepEqual(await queued, { success: false, error: "El pago fue restablecido antes de registrarse." }, cancellation);
    assert.equal(reads, 0, `${cancellation} prevents queued state reads`);
    assert.equal(demo.commits.length, 0);
    assert.equal((await pay(demo.callback)).success, true, `${cancellation} permits fresh work`);

    assert.equal("requiresConfirmation" in await pay(demo.callback, undefined, "100", "2030-08-03"), true);
    const readsBeforeConfirmation = reads;
    const commitsBeforeConfirmation = demo.commits.length;
    const confirmed = pay(demo.callback, undefined, "100", "2030-08-03", { ...registration, confirmedDuplicate: true });
    demo.callback[cancellation]();
    assert.deepEqual(await confirmed, { success: false, error: "El pago fue restablecido antes de registrarse." }, `${cancellation} cancels an already-bound confirmation`);
    assert.equal(reads, readsBeforeConfirmation, `${cancellation} reads no additional state for cancelled confirmation`);
    assert.equal(demo.commits.length, commitsBeforeConfirmation, `${cancellation} commits no confirmed payment`);
    assert.equal(demo.state.payments.length, 1, `${cancellation} adds no confirmed payment`);
    assert.equal(demo.state.students[0].nextPaymentDate, "2030-07-03", `${cancellation} leaves the due date unchanged`);
    assert.deepEqual(await pay(demo.callback, undefined, "100", "2030-08-03", { ...registration, confirmedDuplicate: true }), confirmationError, `${cancellation} clears stale confirmation`);
  }
});

test("reentrant trusted dependencies cancel old work, preserve its issued IDs, and leave new-generation work coalescible", async () => {
  for (const dependency of ["getState", "today", "nextId"]) {
    let state = createGymFinanceDemoFixture(anchor);
    let callback;
    let replacement;
    let calls = 0;
    let committed = 0;
    const cancelAndReplace = () => {
      if (replacement) return;
      callback.cancelPending();
      replacement = pay(callback, undefined, "77", "2030-07-03");
      assert.equal(replacement, pay(callback, undefined, "77", "2030-07-03"), `${dependency} replacement coalesces while queued`);
    };
    callback = createGymFinancePaymentCallbackFactory({
      gymActorToken: admin,
      getState: () => {
        if (dependency === "getState") cancelAndReplace();
        return state;
      },
      today: dependency === "today" ? () => { cancelAndReplace(); return anchor; } : undefined,
      nextId: dependency === "nextId" ? () => {
        calls += 1;
        if (calls === 1) {
          cancelAndReplace();
          return "aborted-payment";
        }
        return calls === 2 ? "fresh-payment" : "fresh-command";
      } : undefined,
      commit: (next) => { state = next; committed += 1; },
    });
    const old = pay(callback);
    assert.deepEqual(await old, { success: false, error: "El pago fue restablecido antes de registrarse." }, dependency);
    assert.ok(replacement, `${dependency} enqueued replacement work`);
    assert.equal((await replacement).success, true, `${dependency} replacement succeeds`);
    assert.equal(committed, 1, `${dependency} old operation never commits`);
    if (dependency === "nextId") assert.notEqual(state.payments[0].id, "aborted-payment", "aborted allocation remains reserved");
  }
});

test("denied or copied/non-GYM tokens cannot observe state, input getters, IDs, or clocks", async () => {
  const hostileToken = Object.defineProperty({}, "id", { get() { throw new Error("actor token getter"); } });
  for (const token of [null, hostileToken, { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" }, { id: "finance-admin", role: "ADMIN" }, getGymDemoActorToken("gym-fixed-student-general")]) {
    let reads = 0;
    const callback = createGymFinancePaymentCallbackFactory({
      gymActorToken: token,
      getState: () => { reads += 1; throw new Error("state"); },
      commit: () => { reads += 1; },
      nextId: () => { reads += 1; return "id"; },
      today: () => { reads += 1; return anchor; },
    });
    const hostile = Object.defineProperty({}, "paidAtStr", { get() { reads += 1; throw new Error("input"); } });
    assert.deepEqual(await callback(hostile, hostile, hostile, hostile), { success: false, error: "No autorizado." });
    assert.equal(reads, 0);
  }
});

test("closed GYM capture rejects foreign/header-invalid graphs without child traversal and never mutates the original state", async () => {
  const base = createGymFinanceDemoFixture(anchor);
  let childReads = 0;
  const foreign = { ...base, namespace: "wody-box-finance-demo", students: new Proxy(base.students, { get() { childReads += 1; throw new Error("child"); } }) };
  let commits = 0;
  const callback = createGymFinancePaymentCallbackFactory({ gymActorToken: admin, getState: () => foreign, commit: () => { commits += 1; } });
  assert.deepEqual(await pay(callback), { success: false, error: "El estado financiero no es válido." });
  assert.equal(childReads, 0);
  assert.equal(commits, 0);

  const detached = new Proxy(createGymFinanceDemoFixture(anchor), {
    get(target, key, receiver) {
      if (key === "toJSON") throw new Error("original toJSON");
      return Reflect.get(target, key, receiver);
    },
  });
  const safe = createGymFinancePaymentCallbackFactory({ gymActorToken: admin, getState: () => detached, commit: () => {} });
  assert.equal((await pay(safe)).success, true, "reducer receives the validator-owned detached graph");
});

test("IDs are checked against the current owned payment ledger, stay lifetime-reserved, bound collision attempts, and allow long valid values", async () => {
  const long = "x".repeat(65);
  const ids = [long, "cmd", "second", "second-cmd"];
  const demo = fixture({ nextId: () => ids.shift() ?? "stuck" });
  assert.equal((await pay(demo.callback)).success, true);
  assert.equal(demo.state.payments[0].id, long);
  demo.state = createGymFinanceDemoFixture(anchor);
  assert.equal((await pay(demo.callback, undefined, "2")).success, true);
  assert.notEqual(demo.state.payments[0].id, long, "factory reservations survive reset");

  let attempts = 0;
  const exhausted = fixture({ nextId: () => { attempts += 1; return "same"; } });
  assert.deepEqual(await pay(exhausted.callback), { success: false, error: "No se pudo asignar un identificador financiero local." });
  assert.equal(attempts, 65, "one accepted payment ID then 64 command collisions; bound per requested ID");
});

test("trusted dependency failures reject without masking, commits, or leaked busy locks", async () => {
  const stateFailure = fixture({ getState: () => { throw new Error("GET_STATE"); } });
  await assert.rejects(pay(stateFailure.callback), /GET_STATE/);
  const idFailure = fixture({ nextId: () => { throw new Error("NEXT_ID"); } });
  await assert.rejects(pay(idFailure.callback), /NEXT_ID/);
  const clockFailure = fixture({ today: () => { throw new Error("CLOCK"); } });
  await assert.rejects(pay(clockFailure.callback), /CLOCK/);
  const commitFailure = fixture({ commit: () => { throw new Error("COMMIT"); } });
  await assert.rejects(pay(commitFailure.callback), /COMMIT/);
  assert.equal((await pay(commitFailure.callback, undefined, "invalid")).success, false, "rejected work releases its pending slot rather than reporting busy");
});
