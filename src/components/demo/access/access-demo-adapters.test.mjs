import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "../finance/catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createAccessDemoFixture, getAccessDemoStudents } from "./access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createAccessDemoCallbackFactory } from "./access-demo-adapters.ts";

const anchor = "2030-06-03";
const now = "2030-06-03T15:00:00.000Z";

function harness(actor = financeCatalogSaleActors.admin) {
  let state = createAccessDemoFixture(anchor);
  let students = getAccessDemoStudents(anchor);
  let commits = 0;
  const callbacks = createAccessDemoCallbackFactory({
    actor,
    getState: () => state,
    getStudents: () => students,
    commit: (next) => { commits += 1; state = next; },
    trustedNow: () => now,
  });
  return { callbacks, get state() { return state; }, set state(value) { state = value; }, get students() { return students; }, set students(value) { students = value; }, get commits() { return commits; } };
}

test("hostile, forged, non-admin, getter, and revoked actors are denied before state, roster, ID, or clock reads", async () => {
  const actors = [
    { id: "finance-admin", role: "ADMIN" },
    financeCatalogSaleActors.teacher,
    { id: "finance-admin-unprivileged", role: "ACCESS", canViewRevenue: true },
    Object.defineProperty({}, "id", { get() { throw new Error("actor read"); } }),
    (() => { const proxy = Proxy.revocable({ id: "finance-admin", role: "ADMIN" }, {}); proxy.revoke(); return proxy.proxy; })(),
  ];
  for (const actor of actors) {
    let reads = 0;
    const callbacks = createAccessDemoCallbackFactory({
      actor,
      getState: () => { reads += 1; throw new Error("state"); },
      getStudents: () => { reads += 1; throw new Error("students"); },
      commit: () => { reads += 1; },
      trustedNow: () => { reads += 1; return now; },
      nextId: () => { reads += 1; return "id"; },
    });
    assert.deepEqual(await callbacks.lookupForKiosk("1"), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.createManualCheckin("fee-student-juan", "GRANT"), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.decideCheckin("anything", "DENY"), { success: false, error: "No autorizado." });
    assert.equal(reads, 0);
  }
});

test("lookup is async-compatible, uses fresh roster dues, supports LITE number/email normalization, and cannot mutate ledger", async () => {
  const local = harness();
  const pendingLookup = local.callbacks.lookupForKiosk(" JUAN@DEMO.COM ");
  local.students = local.students.map((student) => student.id === "fee-student-juan" ? { ...student, nextPaymentDate: anchor } : student);
  const juan = await pendingLookup;
  assert.equal(juan.success, true);
  assert.equal(juan.alDia, true);
  assert.equal((await local.callbacks.lookupForKiosk("000006")).success, true);
  assert.deepEqual(await local.callbacks.lookupForKiosk("archivado@demo.com"), { success: false, error: "No se encontró ningún socio con ese identificador." });
  assert.equal(local.state.logs.length, 15);
  assert.deepEqual(await local.callbacks.lookupForKiosk("   "), { success: false, error: "Ingresá un identificador." });
});

test("manual and pending commands read fresh state/roster at execution, commit only success, and retain current finance data outside access bytes", async () => {
  const local = harness();
  const manual = await local.callbacks.createManualCheckin("fee-student-maria", "GRANT");
  assert.equal(manual.success, true, "blocked current student may be manually overridden");
  assert.equal(local.commits, 1);
  assert.equal(local.state.logs.at(-1).decidedById, financeCatalogSaleActors.admin.id);
  const before = local.state;
  assert.deepEqual(await local.callbacks.createManualCheckin("fee-student-archived", "DENY"), { success: false, error: "Alumno no encontrado." });
  assert.equal(local.state, before);
  const pending = local.state.logs.find((log) => log.state === "PENDING");
  const decided = await local.callbacks.decideCheckin(pending.id, "GRANT");
  assert.deepEqual(decided, { success: true, logId: pending.id, state: "GRANTED" });
  assert.equal(local.commits, 2);
  assert.deepEqual(await local.callbacks.decideCheckin(pending.id, "DENY"), { success: false, error: "Este ingreso ya fue resuelto." });
});

test("identical in-flight re-entry coalesces, settled repeated admissions reserve fresh lifetime IDs, and collisions are skipped", async () => {
  const local = harness();
  const first = local.callbacks.createManualCheckin("fee-student-lucas", "GRANT");
  const same = local.callbacks.createManualCheckin("fee-student-lucas", "GRANT");
  assert.equal(first, same);
  assert.equal((await first).success, true);
  assert.equal(local.commits, 1);
  const repeated = await local.callbacks.createManualCheckin("fee-student-lucas", "GRANT");
  assert.equal(repeated.success, true);
  const added = local.state.logs.slice(-2).map((log) => log.id);
  assert.deepEqual(added, ["access-log-local-1", "access-log-local-2"]);

  local.state = { ...local.state, logs: [...local.state.logs, { ...local.state.logs[0], id: "access-log-local-3" }] };
  const afterRestore = await local.callbacks.createManualCheckin("fee-student-sofia", "DENY");
  assert.equal(afterRestore.success, true);
  assert.equal(afterRestore.logId, "access-log-local-4", "restored collision cannot reuse a reserved/persisted identifier");
});

test("cancel reset invalidates queued writes and old promise cleanup cannot clobber a new same-signature request", async () => {
  const local = harness();
  const old = local.callbacks.createManualCheckin("fee-student-tomas", "GRANT");
  local.callbacks.cancelPending();
  const replacement = local.callbacks.createManualCheckin("fee-student-tomas", "GRANT");
  assert.notEqual(old, replacement);
  assert.deepEqual(await old, { success: false, error: "La operación fue cancelada." });
  assert.equal((await replacement).success, true);
  assert.equal(local.commits, 1);
});

test("history and daily feed are authorized projections without an invented feed-limit API", () => {
  const local = harness(financeCatalogSaleActors.unprivilegedAdmin);
  assert.equal(local.callbacks.getHistory().length, 15);
  const feed = local.callbacks.getDailyFeed();
  assert.equal(Array.isArray(feed.pending), true);
  assert.equal(Array.isArray(feed.recent), true);
  const denied = harness(financeCatalogSaleActors.teacher);
  assert.equal(denied.callbacks.getHistory(), null);
  assert.equal(denied.callbacks.getDailyFeed(), null);
});
