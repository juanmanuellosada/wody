import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID, getGymDemoActorToken } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymAccessDemoFixture, getGymAccessDemoStudents } from "./gym-access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { applyGymAccessProfileOverrides, createManualGymAccess, decidePendingGymAccess, isAuthorizedGymAccessActor, isGymAccessAlDia, isGymAccessDate, isValidGymAccessDemoState, lookupGymAccessStudent, projectGymAccessDailyFeed, projectGymAccessHistory } from "./gym-access-demo-state.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const teacher = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const students = getGymAccessDemoStudents(anchor);
// Safely later than every fixture history row's own `at` on the anchor day (latest is 13:40Z).
const iso = "2030-06-03T23:00:00.000Z";

const personalizedId = "gym-fixed-student-personalized";
const muslibId = "gym-fixed-student-muslib";
const generalId = "gym-fixed-student-general";
const archivedId = "gym-fixed-student-muslib-archived";

test("fixture derives the six-student GYM finance roster and a fictional ten-row history", () => {
  const state = createGymAccessDemoFixture(anchor);
  assert.equal(students.length, 6);
  assert.equal(students.filter((student) => !student.deletedAt).length, 5);
  assert.equal(state.logs.length, 10);
  assert.equal(state.namespace, "wody-gym-access-demo-v1");
  assert.equal(state.logs.every((log) => log.userId.startsWith("gym-fixed-student-")), true);
  assert.equal(state.logs.filter((log) => log.state === "PENDING").every((log) => log.decidedAt === null && log.decidedById === null), true);
  assert.equal(state.logs.filter((log) => log.state === "DENIED").every((log) => log.decidedById === GYM_DEMO_ADMIN_ID), true);
});

test("only the single canonical GYM ADMIN token authorizes; a TEACHER token and a bare id string are refused", () => {
  assert.equal(isAuthorizedGymAccessActor(admin), true);
  assert.equal(isAuthorizedGymAccessActor(teacher), false, "TEACHER is not an access operator");
  assert.equal(isAuthorizedGymAccessActor(GYM_DEMO_ADMIN_ID), false, "a raw id string is not a token");
  assert.equal(isAuthorizedGymAccessActor(null), false);
  assert.equal(isAuthorizedGymAccessActor({}), false, "an unrelated object never resolves to an actor");
});

test("lookup uses canonical member numbers, excludes archived students, and normalizes email", () => {
  const irene = lookupGymAccessStudent("0005", students, anchor);
  assert.equal(irene.success, true);
  assert.equal(irene.user.memberNumber, 5);
  assert.equal(irene.user.name, "Irene Soto");
  const email = lookupGymAccessStudent("  gym-fixed-student-general@finance-demo.invalid ".trim().toUpperCase(), students, anchor);
  assert.equal(email.success, true);
  assert.equal(email.user.id, generalId);
  assert.deepEqual(lookupGymAccessStudent("0009", students, anchor), { success: false, error: "No se encontró ningún socio con ese identificador." });
  assert.deepEqual(lookupGymAccessStudent("", students, anchor), { success: false, error: "Ingresá un identificador." });
  const before = createGymAccessDemoFixture(anchor).logs.length;
  lookupGymAccessStudent("0005", students, anchor);
  assert.equal(createGymAccessDemoFixture(anchor).logs.length, before, "lookup never creates a log");
  if (irene.success) {
    irene.user.name = "mutated";
    assert.equal(students.find((s) => s.id === personalizedId).name, "Irene Soto", "lookup returns a detached DTO");
  }
});

test("al dia rule: blocked wins, then exemption, then the due-date comparison", () => {
  assert.equal(isGymAccessAlDia({ nextPaymentDate: anchor, blocked: true, paymentExempt: true }, anchor), false, "blocked wins even when exempt");
  assert.equal(isGymAccessAlDia({ nextPaymentDate: "2020-01-01", blocked: false, paymentExempt: true }, anchor), true, "exempt wins over an overdue date");
  assert.equal(isGymAccessAlDia({ nextPaymentDate: "2020-01-01", blocked: false, paymentExempt: false }, anchor), false, "overdue and not exempt is denied");
  assert.equal(isGymAccessAlDia({ nextPaymentDate: anchor, blocked: false, paymentExempt: false }, anchor), true, "due today is current");
  assert.equal(isGymAccessAlDia({ nextPaymentDate: "not-a-date", blocked: false, paymentExempt: false }, anchor), false, "invalid due date fails closed");
});

test("applyGymAccessProfileOverrides: the connection point — overridden students take the bridge's blocked/exempt, absent ones keep finance's own value", () => {
  const overrides = new Map([
    [personalizedId, { blocked: false, paymentExempt: false }], // finance itself marks this student blocked: true
    [muslibId, { blocked: false, paymentExempt: false }], // finance itself marks this student paymentExempt: true
  ]);
  const blended = applyGymAccessProfileOverrides(students, overrides);
  const personalized = blended.find((s) => s.id === personalizedId);
  const muslib = blended.find((s) => s.id === muslibId);
  const general = blended.find((s) => s.id === generalId);
  const rawPersonalized = students.find((s) => s.id === personalizedId);
  const rawMuslib = students.find((s) => s.id === muslibId);
  const rawGeneral = students.find((s) => s.id === generalId);

  assert.equal(rawPersonalized.blocked, true, "sanity: finance itself blocks this student");
  assert.equal(personalized.blocked, false, "the bridge override unblocks it for access");
  assert.equal(rawMuslib.paymentExempt, true, "sanity: finance itself exempts this student");
  assert.equal(muslib.paymentExempt, false, "the bridge override removes the exemption for access");
  // Requirement 3: a student absent from the bridge keeps exactly its finance-derived behavior.
  assert.deepEqual(general, rawGeneral, "a student with no override is byte-identical to its finance row");
  // Untouched fields never come from the override, even for an overridden row.
  assert.equal(personalized.nextPaymentDate, rawPersonalized.nextPaymentDate);
  assert.equal(personalized.name, rawPersonalized.name);
  assert.equal(personalized.email, rawPersonalized.email);

  const noOverrides = applyGymAccessProfileOverrides(students, undefined);
  assert.deepEqual(noOverrides, students, "an absent overrides map changes nothing");
});

test("end to end: bridge blocked denies entry, unblocking restores it, and the bridge exemption drives the payment rule exactly like Cuotas", () => {
  // Requirement 1: blocking a normally-current student through the bridge denies entry; unblocking restores it.
  const blockOverride = new Map([[personalizedId, { blocked: true, paymentExempt: false }]]);
  const blocked = lookupGymAccessStudent("0005", applyGymAccessProfileOverrides(students, blockOverride), anchor);
  assert.equal(blocked.success, true);
  assert.equal(blocked.alDia, false, "the bridge blocking this current student denies auto-entry");

  const unblockOverride = new Map([[personalizedId, { blocked: false, paymentExempt: false }]]);
  const unblocked = lookupGymAccessStudent("0005", applyGymAccessProfileOverrides(students, unblockOverride), anchor);
  assert.equal(unblocked.alDia, true, "unblocking through the bridge restores entry for this due-current student");

  // Requirement 2: an exemption affects the payment-based rule, same as Cuotas — MUSLIB is overdue in finance
  // and only current because of the exemption; removing it through the bridge must deny entry.
  const removedExemption = new Map([[muslibId, { blocked: false, paymentExempt: false }]]);
  const noLongerExempt = lookupGymAccessStudent("0007", applyGymAccessProfileOverrides(students, removedExemption), anchor);
  assert.equal(noLongerExempt.alDia, false, "an overdue, no-longer-exempt student is denied auto-entry");

  const stillExempt = lookupGymAccessStudent("0007", students, anchor);
  assert.equal(stillExempt.alDia, true, "sanity: MUSLIB is only current because finance's own exemption is honored by default");

  // Requirement 3: GENERAL (never touched by the bridge) keeps its finance-derived behavior either way.
  const partialOverrides = new Map([[personalizedId, { blocked: true, paymentExempt: false }]]);
  const untouched = lookupGymAccessStudent("0004", applyGymAccessProfileOverrides(students, partialOverrides), anchor);
  const rawUntouched = lookupGymAccessStudent("0004", students, anchor);
  assert.equal(untouched.alDia, rawUntouched.alDia, "a student absent from the bridge is unaffected by another student's override");
});

test("closed schema: namespace, version, shape, known-student membership, and decision invariants", () => {
  const valid = createGymAccessDemoFixture(anchor);
  assert.equal(isValidGymAccessDemoState(valid), true);
  assert.equal(isValidGymAccessDemoState({ ...valid, namespace: "wody-box-access-demo-v1" }), false, "never accepts BOX's namespace");
  assert.equal(isValidGymAccessDemoState({ ...valid, version: 2 }), false);
  assert.equal(isValidGymAccessDemoState({ ...valid, logs: "nope" }), false);
  assert.equal(isValidGymAccessDemoState({ ...valid, extra: 1 }), false, "closed key set");
  assert.equal(isValidGymAccessDemoState(null), false);

  const unknownStudent = { ...valid, logs: [{ id: "x", userId: "not-a-gym-student", at: iso, state: "GRANTED", decidedById: GYM_DEMO_ADMIN_ID, decidedAt: iso }] };
  assert.equal(isValidGymAccessDemoState(unknownStudent), false);

  const duplicateId = { ...valid, logs: [valid.logs[0], valid.logs[0]] };
  assert.equal(isValidGymAccessDemoState(duplicateId), false, "duplicate log ids are rejected");

  const decidedByNonAdmin = { ...valid, logs: [{ id: "x", userId: generalId, at: iso, state: "GRANTED", decidedById: GYM_DEMO_PRIMARY_TEACHER_ID, decidedAt: iso }] };
  assert.equal(isValidGymAccessDemoState(decidedByNonAdmin), false, "only the canonical GYM ADMIN can appear as decidedById");

  const pendingWithDecision = { ...valid, logs: [{ id: "x", userId: generalId, at: iso, state: "PENDING", decidedById: GYM_DEMO_ADMIN_ID, decidedAt: iso }] };
  assert.equal(isValidGymAccessDemoState(pendingWithDecision), false, "a PENDING row cannot carry a decision");

  const deniedWithoutDecision = { ...valid, logs: [{ id: "x", userId: generalId, at: iso, state: "DENIED", decidedById: null, decidedAt: null }] };
  assert.equal(isValidGymAccessDemoState(deniedWithoutDecision), false, "a DENIED row must carry a decision");

  const decidedBeforeAt = { ...valid, logs: [{ id: "x", userId: generalId, at: iso, state: "DENIED", decidedById: GYM_DEMO_ADMIN_ID, decidedAt: "2030-06-01T00:00:00.000Z" }] };
  assert.equal(isValidGymAccessDemoState(decidedBeforeAt), false, "decidedAt cannot precede at");
});

test("key enumeration matches gym-demo-profile-core.ts's Reflect.ownKeys check: a non-enumerable extra own key is rejected, not silently ignored", () => {
  const valid = createGymAccessDemoFixture(anchor);

  const withHiddenTopLevelKey = { ...valid };
  Object.defineProperty(withHiddenTopLevelKey, "hidden", { value: "smuggled", enumerable: false });
  // Object.keys would not see "hidden" at all, so a validator built on it would wrongly accept this.
  assert.deepEqual(Object.keys(withHiddenTopLevelKey), Object.keys(valid), "sanity: Object.keys is blind to the smuggled key");
  assert.equal(isValidGymAccessDemoState(withHiddenTopLevelKey), false, "a non-enumerable extra key on the state itself is rejected");

  const hiddenLog = { ...valid.logs[0] };
  Object.defineProperty(hiddenLog, "hidden", { value: "smuggled", enumerable: false });
  const withHiddenLogKey = { ...valid, logs: [hiddenLog] };
  assert.equal(isValidGymAccessDemoState(withHiddenLogKey), false, "a non-enumerable extra key on a log row is rejected");
});

test("createManualGymAccess: authorization, unknown decision, deleted or unknown student, and id collision", () => {
  const state = createGymAccessDemoFixture(anchor);
  const nextId = () => "gym-access-log-new-1";

  const unauthorized = createManualGymAccess(state, teacher, students, generalId, "GRANT", iso, nextId);
  assert.deepEqual(unauthorized.result, { success: false, error: "No autorizado." });
  assert.equal(unauthorized.state, state);

  const badDecision = createManualGymAccess(state, admin, students, generalId, "MAYBE", iso, nextId);
  assert.equal(badDecision.result.success, false);

  const archived = createManualGymAccess(state, admin, students, archivedId, "GRANT", iso, nextId);
  assert.deepEqual(archived.result, { success: false, error: "Alumno no encontrado." });

  const granted = createManualGymAccess(state, admin, students, generalId, "GRANT", iso, nextId);
  assert.equal(granted.result.success, true);
  assert.equal(granted.result.state, "GRANTED");
  const created = granted.state.logs.find((log) => log.id === "gym-access-log-new-1");
  assert.equal(created.decidedById, GYM_DEMO_ADMIN_ID);
  assert.equal(created.decidedAt, iso);

  const collision = createManualGymAccess(state, admin, students, generalId, "GRANT", iso, () => state.logs[0].id);
  assert.equal(collision.result.success, false);
});

test("decidePendingGymAccess: only resolves an existing PENDING row, once, and only forward in time", () => {
  const state = createGymAccessDemoFixture(anchor);
  const pendingLog = state.logs.find((log) => log.state === "PENDING");

  const unauthorized = decidePendingGymAccess(state, teacher, pendingLog.id, "GRANT", iso);
  assert.deepEqual(unauthorized.result, { success: false, error: "No autorizado." });

  const stale = decidePendingGymAccess(state, admin, pendingLog.id, "GRANT", "2020-01-01T00:00:00.000Z");
  assert.equal(stale.result.success, false, "a decision instant before the pending log's own instant is rejected");

  const resolved = decidePendingGymAccess(state, admin, pendingLog.id, "DENY", iso);
  assert.equal(resolved.result.success, true);
  assert.equal(resolved.result.state, "DENIED");
  const updated = resolved.state.logs.find((log) => log.id === pendingLog.id);
  assert.equal(updated.decidedById, GYM_DEMO_ADMIN_ID);

  const alreadyResolved = decidePendingGymAccess(resolved.state, admin, pendingLog.id, "GRANT", iso);
  assert.deepEqual(alreadyResolved.result, { success: false, error: "Este ingreso ya fue resuelto." });

  const missing = decidePendingGymAccess(state, admin, "no-such-log", "GRANT", iso);
  assert.deepEqual(missing.result, { success: false, error: "Ingreso no encontrado." });
});

test("projections authorize before reading the ledger, resolve the operator name only for GYM ADMIN decisions, and never leak mutable references", () => {
  const state = createGymAccessDemoFixture(anchor);
  assert.equal(projectGymAccessHistory(state, teacher, students, "Lucía Romero"), null, "TEACHER cannot read history");
  assert.equal(projectGymAccessDailyFeed(state, teacher, students, "Lucía Romero", anchor, iso), null);

  const history = projectGymAccessHistory(state, admin, students, "Lucía Romero");
  assert.equal(history.length, state.logs.length);
  const denied = history.find((row) => row.state === "DENIED");
  assert.equal(denied.decidedByName, "Lucía Romero");
  const pending = history.find((row) => row.state === "PENDING");
  assert.equal(pending.decidedByName, null);

  if (denied.user) {
    denied.user.name = "mutated";
    assert.notEqual(students.find((s) => s.id === denied.userId)?.name, "mutated");
  }

  const feed = projectGymAccessDailyFeed(state, admin, students, "Lucía Romero", anchor, iso);
  assert.equal(feed.date, anchor);
  assert.equal(Array.isArray(feed.pending), true);
  assert.equal(Array.isArray(feed.recent), true);
});

test("isGymAccessDate rejects malformed or out-of-range calendar dates", () => {
  assert.equal(isGymAccessDate("2030-06-03"), true);
  assert.equal(isGymAccessDate("2030-02-30"), false);
  assert.equal(isGymAccessDate("not-a-date"), false);
  assert.equal(isGymAccessDate(undefined), false);
});
