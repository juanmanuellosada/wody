import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID, getGymDemoActorToken } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymAccessDemoFixture, getGymAccessDemoStudents } from "./gym-access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymAccessDemoCallbackFactory } from "./gym-access-demo-adapters.ts";

const anchor = "2030-06-03";
const now = "2030-06-03T23:00:00.000Z";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const teacher = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const generalId = "gym-fixed-student-general";
const personalizedId = "gym-fixed-student-personalized";
const archivedId = "gym-fixed-student-muslib-archived";

function harness(actorToken = admin) {
  let state = createGymAccessDemoFixture(anchor);
  let students = getGymAccessDemoStudents(anchor);
  let commits = 0;
  const callbacks = createGymAccessDemoCallbackFactory({
    actorToken,
    operatorName: "Lucía Romero",
    getState: () => state,
    getFinanceStudents: () => students,
    commit: (next) => { commits += 1; state = next; },
    trustedNow: () => now,
  });
  return { callbacks, get state() { return state; }, set state(value) { state = value; }, get students() { return students; }, set students(value) { students = value; }, get commits() { return commits; } };
}

test("a TEACHER token, a forged plain object, and null are all denied before state, roster, id, or clock reads", async () => {
  const actors = [teacher, { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" }, null, {}];
  for (const actorToken of actors) {
    let reads = 0;
    const callbacks = createGymAccessDemoCallbackFactory({
      actorToken,
      operatorName: "Lucía Romero",
      getState: () => { reads += 1; throw new Error("state"); },
      getFinanceStudents: () => { reads += 1; throw new Error("students"); },
      commit: () => { reads += 1; },
      trustedNow: () => { reads += 1; return now; },
      nextId: () => { reads += 1; return "id"; },
    });
    assert.deepEqual(await callbacks.lookupForKiosk("0004"), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.createManualCheckin(generalId, "GRANT"), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.decideCheckin("anything", "DENY"), { success: false, error: "No autorizado." });
    assert.equal(reads, 0);
  }
});

test("lookupForKiosk applies the profileOverrides argument at call time, not a snapshot captured earlier", async () => {
  const local = harness();
  const rawResult = await local.callbacks.lookupForKiosk("0005"); // Irene Soto, finance-blocked by fixture
  assert.equal(rawResult.success, true);
  assert.equal(rawResult.alDia, false, "raw finance data blocks this student");

  const overrides = new Map([[personalizedId, { blocked: false, paymentExempt: false }]]);
  const overridden = await local.callbacks.lookupForKiosk("0005", overrides);
  assert.equal(overridden.alDia, true, "an override passed at call time unblocks the same lookup");

  assert.equal(local.state.logs.length, 10, "lookup never creates a log regardless of overrides");
});

test("createManualCheckin honors the same call-time overrides used to build the log, but a manual grant works even without them", async () => {
  const local = harness();
  const granted = await local.callbacks.createManualCheckin(generalId, "GRANT");
  assert.equal(granted.success, true);
  assert.equal(local.commits, 1);
  assert.equal(local.state.logs.at(-1).decidedById, GYM_DEMO_ADMIN_ID);

  const overrides = new Map([[generalId, { blocked: true, paymentExempt: false }]]);
  const stillGranted = await local.callbacks.createManualCheckin(generalId, "GRANT", overrides);
  assert.equal(stillGranted.success, true, "a manual GRANT is a staff decision; createManualGymAccess itself does not re-check blocked");

  const archived = await local.callbacks.createManualCheckin(archivedId, "DENY");
  assert.deepEqual(archived, { success: false, error: "Alumno no encontrado." });
});

test("decideCheckin resolves an existing PENDING row without needing any roster or overrides", async () => {
  const local = harness();
  const pending = local.state.logs.find((log) => log.state === "PENDING");
  const decided = await local.callbacks.decideCheckin(pending.id, "GRANT");
  assert.deepEqual(decided, { success: true, logId: pending.id, state: "GRANTED" });
  assert.equal(local.commits, 1);
  assert.deepEqual(await local.callbacks.decideCheckin(pending.id, "DENY"), { success: false, error: "Este ingreso ya fue resuelto." });
});

test("identical in-flight manual re-entry coalesces into one commit and reserves its own local id namespace", async () => {
  const local = harness();
  const first = local.callbacks.createManualCheckin(generalId, "GRANT");
  const same = local.callbacks.createManualCheckin(generalId, "GRANT");
  assert.equal(first, same);
  assert.equal((await first).success, true);
  assert.equal(local.commits, 1);
  assert.equal(local.state.logs.at(-1).id, "gym-access-log-local-1");
});

test("cancelPending invalidates queued writes without touching a fresh replacement request", async () => {
  const local = harness();
  const old = local.callbacks.createManualCheckin(generalId, "GRANT");
  local.callbacks.cancelPending();
  const replacement = local.callbacks.createManualCheckin(generalId, "GRANT");
  assert.notEqual(old, replacement);
  assert.deepEqual(await old, { success: false, error: "La operación fue cancelada." });
  assert.equal((await replacement).success, true);
  assert.equal(local.commits, 1);
});

test("history and daily feed apply profileOverrides too and stay authorized-only", () => {
  const local = harness();
  const rawHistory = local.callbacks.getHistory();
  assert.equal(rawHistory.length, 10);
  const feed = local.callbacks.getDailyFeed();
  assert.equal(Array.isArray(feed.pending), true);
  assert.equal(Array.isArray(feed.recent), true);

  const denied = harness(teacher);
  assert.equal(denied.callbacks.getHistory(), null);
  assert.equal(denied.callbacks.getDailyFeed(), null);
});
