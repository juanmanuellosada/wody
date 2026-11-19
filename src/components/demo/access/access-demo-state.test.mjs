import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "../finance/catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createAccessDemoFixture, getAccessDemoOperatorName, getAccessDemoStudents } from "./access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  createManualAccess,
  decidePendingAccess,
  isAccessAlDia,
  isAccessDate,
  lookupAccessStudent,
  projectAccessDailyFeed,
  projectAccessHistory,
} from "./access-demo-state.ts";

const anchor = "2030-06-03";
const admin = financeCatalogSaleActors.admin;
const otherAdmin = financeCatalogSaleActors.unprivilegedAdmin;
const students = getAccessDemoStudents(anchor);
const iso = "2030-06-03T12:00:00.000Z";

test("fixture derives the seven active plus archived canonical fee roster and preserves a fictional 15-row history", () => {
  const state = createAccessDemoFixture(anchor);
  assert.equal(students.length, 8);
  assert.equal(students.filter((student) => !student.deletedAt).length, 7);
  assert.equal(state.logs.length, 15);
  assert.equal(state.logs.every((log) => /^fee-student-/.test(log.userId)), true);
  assert.equal(state.logs.filter((log) => log.state === "PENDING").every((log) => log.decidedAt === null && log.decidedById === null), true);
  assert.equal(state.logs.filter((log) => log.state === "DENIED").every((log) => log.decidedById === admin.id), true);
});

test("lookup normalizes email and member number, excludes archived users, returns detached students, and reads no ledger", () => {
  const state = createAccessDemoFixture(anchor);
  const email = lookupAccessStudent("  JUAN@DEMO.COM ", students, anchor);
  assert.equal(email.success, true);
  assert.equal(email.user.memberNumber, 1);
  assert.equal(email.alDia, false);
  assert.equal(lookupAccessStudent("000006", students, anchor).success, true, "LITE/null-email lookup works by leading-zero number");
  assert.deepEqual(lookupAccessStudent("archivado@demo.com", students, anchor), { success: false, error: "No se encontró ningún socio con ese identificador." });
  assert.deepEqual(lookupAccessStudent("", students, anchor), { success: false, error: "Ingresá un identificador." });
  assert.deepEqual(lookupAccessStudent("1234567", students, anchor), { success: false, error: "No se encontró ningún socio con ese identificador." });
  assert.equal(state.logs.length, 15, "lookup never creates a log");
  if (email.success) {
    email.user.name = "mutated";
    assert.equal(students[0].name, "Juan Pérez");
  }
});

test("al día observes current fees with blocked-before-exempt precedence and documents non-student parity", () => {
  assert.equal(isAccessAlDia(students.find((student) => student.id === "fee-student-maria"), anchor), false, "blocked wins");
  assert.equal(isAccessAlDia(students.find((student) => student.id === "fee-student-valentina"), anchor), true, "exempt wins over overdue");
  assert.equal(isAccessAlDia({ nextPaymentDate: "2030-01-01", blocked: false, paymentExempt: false, role: "ADMIN" }, anchor), true);
  const current = students.map((student) => student.id === "fee-student-juan" ? { ...student, nextPaymentDate: anchor } : student);
  assert.equal(lookupAccessStudent("1", current, anchor).success, true);
  assert.equal(lookupAccessStudent("1", current, anchor).alDia, true, "fresh changed due date is used");
});

test("operator label lookup returns only canonical own labels and cannot inherit mutable prototype fields", () => {
  assert.equal(getAccessDemoOperatorName(admin.id), "Administración demo");
  assert.equal(getAccessDemoOperatorName(otherAdmin.id), "Administrador sin acceso a recaudación");
  for (const value of ["toString", "constructor", "__proto__", "hasOwnProperty", "unknown", "", null]) {
    assert.equal(getAccessDemoOperatorName(value), null, String(value));
  }
  const inherited = "accessDemoInheritedLabel";
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, inherited);
  Object.defineProperty(Object.prototype, inherited, { configurable: true, value: "must-not-resolve" });
  try {
    assert.equal(getAccessDemoOperatorName(inherited), null);
  } finally {
    if (previous) Object.defineProperty(Object.prototype, inherited, previous);
    else Reflect.deleteProperty(Object.prototype, inherited);
  }
});

test("manual admissions are resolved overrides for active students, repeat as independent history, and reject invalid decisions", () => {
  const initial = createAccessDemoFixture(anchor);
  const blocked = createManualAccess(initial, admin, students, "fee-student-maria", "GRANT", iso, () => "manual-1");
  assert.deepEqual(blocked.result, { success: true, logId: "manual-1", state: "GRANTED" });
  const repeated = createManualAccess(blocked.state, otherAdmin, students, "fee-student-maria", "DENY", "2030-06-03T12:01:00.000Z", () => "manual-2");
  assert.equal(repeated.state.logs.length, initial.logs.length + 2);
  assert.equal(repeated.state.logs.at(-1).decidedById, otherAdmin.id);
  const manualHistory = projectAccessHistory(repeated.state, admin, students);
  assert.deepEqual(
    manualHistory.filter((row) => row.id === "manual-1" || row.id === "manual-2").map((row) => [row.decidedById, row.decidedByName]),
    [[otherAdmin.id, "Administrador sin acceso a recaudación"], [admin.id, "Administración demo"]],
  );
  for (const [userId, decision, expected] of [["fee-student-archived", "GRANT", "Alumno no encontrado."], ["fee-student-juan", "OTHER", "La decisión no es válida."]]) {
    const transition = createManualAccess(initial, admin, students, userId, decision, iso, () => "bad");
    assert.equal(transition.state, initial);
    assert.deepEqual(transition.result, { success: false, error: expected });
  }
});

test("only frozen ADMIN roster references authorize before reducer state work; forged roles, getters, and revoked proxies fail safely", () => {
  let stateReads = 0;
  const hostile = [
    { id: admin.id, role: "ADMIN" },
    financeCatalogSaleActors.teacher,
    { id: "outside", role: "ADMIN", canViewRevenue: true },
    Object.create({ id: admin.id, role: "ADMIN" }),
    Object.defineProperty({}, "id", { get() { throw new Error("read"); } }),
    Proxy.revocable({ id: admin.id, role: "ADMIN" }, {}).proxy,
  ];
  for (const actor of hostile) {
    const transition = createManualAccess(createAccessDemoFixture(anchor), actor, students, "fee-student-juan", "GRANT", iso, () => { stateReads += 1; return "never"; });
    assert.deepEqual(transition.result, { success: false, error: "No autorizado." });
  }
  assert.equal(stateReads, 0);
});

test("pending decision is single-transition, preserves other history, and requires trusted chronological decision time", () => {
  const initial = createAccessDemoFixture(anchor);
  const pending = initial.logs.find((log) => log.state === "PENDING");
  const resolved = decidePendingAccess(initial, admin, pending.id, "DENY", "2030-06-03T14:00:00.000Z");
  assert.deepEqual(resolved.result, { success: true, logId: pending.id, state: "DENIED" });
  assert.equal(resolved.state.logs.filter((log) => log.id !== pending.id).every((log, index) => log === initial.logs.filter((old) => old.id !== pending.id)[index]), true);
  const resolvedByOtherAdmin = decidePendingAccess(initial, otherAdmin, pending.id, "GRANT", "2030-06-03T14:00:00.000Z");
  assert.deepEqual(resolvedByOtherAdmin.result, { success: true, logId: pending.id, state: "GRANTED" });
  const resolvedHistory = projectAccessHistory(resolvedByOtherAdmin.state, admin, students).find((row) => row.id === pending.id);
  assert.deepEqual([resolvedHistory.decidedById, resolvedHistory.decidedByName], [otherAdmin.id, "Administrador sin acceso a recaudación"]);
  assert.deepEqual(decidePendingAccess(resolved.state, admin, pending.id, "GRANT", "2030-06-03T14:01:00.000Z").result, { success: false, error: "Este ingreso ya fue resuelto." });
  assert.deepEqual(decidePendingAccess(initial, admin, "missing", "GRANT", iso).result, { success: false, error: "Ingreso no encontrado." });
  assert.deepEqual(decidePendingAccess(initial, admin, pending.id, "NO", iso).result, { success: false, error: "La decisión no es válida." });
});

test("history is stable newest-first capped at 200, resolves archived current roster relation, and projections authorize first", () => {
  const original = createAccessDemoFixture(anchor);
  const extended = { ...original, logs: Array.from({ length: 205 }, (_, index) => ({ id: `z-${index}`, userId: "fee-student-archived", at: `2030-06-03T12:00:${String(index % 60).padStart(2, "0")}.000Z`, state: "GRANTED", decidedById: null, decidedAt: null })) };
  const rows = projectAccessHistory(extended, admin, students);
  assert.equal(rows.length, 200);
  assert.equal(rows[0].id, "z-119", "same-time IDs break ties deterministically");
  assert.equal(rows.some((row) => row.user?.id === "fee-student-archived"), true);
  const fixtureRows = projectAccessHistory(original, admin, students);
  assert.equal(fixtureRows.filter((row) => row.decidedById === admin.id).every((row) => row.decidedByName === "Administración demo"), true);
  assert.equal(fixtureRows.filter((row) => row.decidedById === null).every((row) => row.decidedByName === null), true);
  const denied = projectAccessHistory(Object.defineProperty({}, "logs", { get() { throw new Error("state read"); } }), financeCatalogSaleActors.teacher, students);
  assert.equal(denied, null, "denied actor cannot trigger hostile state getter");
});

test("daily feed follows Argentina 03:00Z boundaries and retains every API-matching row in actual order", () => {
  const state = {
    version: 1,
    namespace: "wody-box-access-demo-v1",
    logs: [
      { id: "before", userId: "fee-student-juan", at: "2030-06-03T02:59:59.999Z", state: "GRANTED", decidedById: null, decidedAt: null },
      { id: "start", userId: "fee-student-juan", at: "2030-06-03T03:00:00.000Z", state: "GRANTED", decidedById: null, decidedAt: null },
      { id: "end", userId: "fee-student-lucas", at: "2030-06-04T03:00:00.000Z", state: "DENIED", decidedById: admin.id, decidedAt: "2030-06-04T03:00:00.000Z" },
      { id: "pending-new", userId: "fee-student-tomas", at: "2030-06-03T12:58:00.000Z", state: "PENDING", decidedById: null, decidedAt: null },
      { id: "pending-old", userId: "fee-student-sofia", at: "2030-06-03T12:54:59.999Z", state: "PENDING", decidedById: null, decidedAt: null },
    ],
  };
  const feed = projectAccessDailyFeed(state, admin, students, anchor, "2030-06-03T13:00:00.000Z");
  assert.deepEqual(feed.recent.map((row) => row.id), ["start"]);
  assert.deepEqual(feed.pending.map((row) => row.id), ["pending-new"]);
  const pending = Array.from({ length: 51 }, (_, index) => ({ id: `pending-${index}`, userId: "fee-student-juan", at: new Date(Date.parse("2030-06-03T12:55:00.000Z") + index).toISOString(), state: "PENDING", decidedById: null, decidedAt: null }));
  const recent = Array.from({ length: 101 }, (_, index) => ({ id: `recent-${index}`, userId: "fee-student-lucas", at: new Date(Date.parse("2030-06-03T04:00:00.000Z") + index).toISOString(), state: "GRANTED", decidedById: null, decidedAt: null }));
  const unbounded = projectAccessDailyFeed({ version: 1, namespace: "wody-box-access-demo-v1", logs: [...pending, ...recent] }, admin, students, anchor, "2030-06-03T13:00:00.000Z");
  assert.deepEqual([unbounded.pending.length, unbounded.recent.length], [51, 101]);
  assert.equal(isAccessDate("0001-02-29"), false);
  assert.equal(isAccessDate("0004-02-29"), true);
});
