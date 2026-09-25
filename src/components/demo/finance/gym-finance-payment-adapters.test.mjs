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

function pay(callback, studentId = "gym-fixed-student-general", amount = "1234,56", nextDate = "2030-07-03", options = registration, gymTeacherStudentLinks = undefined) {
  return callback(studentId, amount, nextDate, options, gymTeacherStudentLinks);
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

  // gymTeacherStudentLinks is a plain call-time argument now, not an injected accessor, so it
  // cannot itself "throw" — but a malformed value is not defensively validated before it reaches
  // resolveHonoredGymTeacherStudentLinks's array-only operations for an actor whose authorization
  // actually consults it (a TEACHER, unlike ADMIN which never reads this value), so it fails the
  // same way any other broken trusted dependency does: a rejection, not a resolved {success:false}.
  // The generic pending-clear in the callback (not a per-dependency try/catch) is what releases the
  // slot. The release proof needs a DIFFERENTLY shaped second call: if the slot were stuck, its
  // mismatched signature would make the callback return a resolved {success:false, error: BUSY}
  // instead of rejecting, which is exactly what assert.rejects below would catch.
  const linksNonArray = fixture({ gymActorToken: teacher });
  await assert.rejects(pay(linksNonArray.callback, undefined, undefined, undefined, registration, "not-an-array"), TypeError);
  await assert.rejects(pay(linksNonArray.callback, "gym-fixed-student-personalized", undefined, undefined, registration, "not-an-array"), TypeError);
});

test("gymTeacherStudentLinks threads a bridge link set into the real reducer, both directions", async () => {
  // The canonically unassigned teacher becomes authorized once the argument grants a link.
  const granted = fixture({ gymActorToken: unassignedTeacher });
  assert.equal(
    (await pay(granted.callback, undefined, undefined, undefined, registration, [{ teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, studentId: "gym-fixed-student-general" }])).success,
    true,
  );

  // The canonically assigned teacher loses authorization once the argument supplies a link set
  // that omits them, even though the canonical directory would still allow it.
  const revoked = fixture({ gymActorToken: teacher });
  assert.deepEqual(await pay(revoked.callback, undefined, undefined, undefined, registration, []), { success: false, error: "Este alumno no está asignado a vos." });

  // Omitted entirely: behavior is byte-identical to before this parameter existed.
  const omitted = fixture({ gymActorToken: teacher });
  assert.equal((await pay(omitted.callback)).success, true);
});

/**
 * The whole point of moving from a provider-held ref to a plain call-time argument: each call
 * carries only its own snapshot, so nothing is shared between calls for one to leave stale or for
 * another to "rewind." Proven directly, not by mutating an external accessor's closure (that
 * technique belonged to the old, now-removed accessor design and no longer represents anything
 * this factory does): the first and third calls both pass their OWN explicit (revoking) link set;
 * the second, sandwiched between them, is for a DIFFERENT student and deliberately OMITS the
 * parameter, falling back to the canonical directory (which does grant that student, unrelated to
 * the first/third). The third call, identical to the first, must be judged exactly as if the
 * second call — with its different student and different (canonical-fallback) argument — never
 * happened. Uses `teacher` (canonically linked to general/personalized/muslib), not
 * `unassignedTeacher`: a successful payment's recordedById is checked against the CANONICAL
 * directory by getValidatedGymFinanceDemoState on every later read (finance-demo-storage.ts),
 * entirely independent of the bridge — a persisted-payment integrity rule, not an authorization
 * one. A successful commit whose dynamic grant has no canonical counterpart would trip that
 * unrelated check on the next read, which would falsely look like this test's own mechanism
 * failing. Using an actor/student pair valid in both keeps this test isolated to the one property
 * it exists to prove.
 */
test("gymTeacherStudentLinks is scoped to each call; no call can leave state behind for another to read or rewind", async () => {
  const demo = fixture({ gymActorToken: teacher });
  const revokeGeneral = []; // dynamically revokes teacher's own canonical access to "general".

  assert.deepEqual(
    await pay(demo.callback, "gym-fixed-student-general", "10", "2030-07-03", registration, revokeGeneral),
    { success: false, error: "Este alumno no está asignado a vos." },
    "the explicit empty override denies access the canonical directory alone would have granted",
  );
  assert.equal(
    (await pay(demo.callback, "gym-fixed-student-muslib", "10", "2030-07-04", { ...registration, paymentMethod: "MERCADO_PAGO" })).success,
    true,
    "a different call, for a different student, omitting the parameter (falls back to canonical, which does grant this one)",
  );
  // Retrying the FIRST student with the SAME revoking override as the first call: the second
  // call's different (canonical-falling-back) argument must not have leaked into or "rewound"
  // this authorization check back toward canonical access.
  assert.deepEqual(
    await pay(demo.callback, "gym-fixed-student-general", "10", "2030-07-05", registration, revokeGeneral),
    { success: false, error: "Este alumno no está asignado a vos." },
  );
});

/**
 * gymTeacherStudentLinks is an authorization input, not just extra data: the pending/busy dedupe
 * key (operationSignature) must treat two calls that differ only in links as DIFFERENT operations.
 * Before this was fixed, a second synchronous call with the same core signature but different
 * links would coalesce onto the SAME pending promise as the first (the busy check compared only
 * actor/studentId/amountInput/nextPaymentDate/paidAt/paymentMethod/confirmedDuplicate), so its
 * caller received a result computed entirely from the FIRST call's links — a wrongful allow
 * whenever the first call's links were more permissive than the second's own.
 */
test("two synchronous calls with the same core signature but different gymTeacherStudentLinks never coalesce onto the same pending slot", async () => {
  const demo = fixture({ gymActorToken: teacher });
  // Call A omits the parameter, falling back to the canonical directory (which grants this
  // teacher access to "general").
  const allowed = pay(demo.callback, "gym-fixed-student-general", "10", "2030-07-03", registration, undefined);
  // Call B, fired synchronously right after with the identical core input, carries an explicit
  // override that REVOKES the same access.
  const denied = pay(demo.callback, "gym-fixed-student-general", "10", "2030-07-03", registration, []);
  assert.notEqual(allowed, denied, "different links must not collapse two calls onto the same pending promise");
  assert.equal((await allowed).success, true, "the first call is judged on its own (canonical-fallback) links");
  assert.deepEqual(
    await denied,
    { success: false, error: "Hay un pago en curso. Esperá un momento." },
    "a same-signature call with different links is rejected as busy, never silently authorized by the other call's links",
  );
  assert.equal(demo.state.payments.length, 1, "only the first call's payment is ever committed");
});

test("two synchronous calls with the same core signature and equal (but distinctly-referenced) links still coalesce into one pending operation", async () => {
  const demo = fixture({ gymActorToken: teacher });
  const linksA = [{ teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: "gym-fixed-student-general" }];
  const linksB = [{ teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: "gym-fixed-student-general" }];
  const first = pay(demo.callback, "gym-fixed-student-general", "10", "2030-07-03", registration, linksA);
  const same = pay(demo.callback, "gym-fixed-student-general", "10", "2030-07-03", registration, linksB);
  assert.equal(first, same, "the same links, in the same order, from a different array reference still coalesce, preserving the original double-click protection");
  assert.equal((await first).success, true);
});

test("a link naming an id other than the acting teacher grants no access through the callback", async () => {
  // Redundantly rejected: isActiveGymTeacherOrAdmin excludes "not-a-real-directory-id" first (it
  // does not resolve to an active TEACHER/ADMIN at all), and the downstream `link.teacherId ===
  // actor.id` match would exclude it too (it is not unassignedTeacher's id). This does not isolate
  // or prove either check alone — see the comment on isActiveGymTeacherOrAdmin in
  // finance-demo-policy.ts for why no test in this codebase can isolate it.
  const demo = fixture({ gymActorToken: unassignedTeacher });
  assert.deepEqual(
    await pay(demo.callback, undefined, undefined, undefined, registration, [{ teacherId: "not-a-real-directory-id", studentId: "gym-fixed-student-general" }]),
    { success: false, error: "Este alumno no está asignado a vos." },
  );
});
