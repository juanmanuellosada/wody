import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
} from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymDemoProfileFixture, getGymDemoProfileActorToken } from "./gym-demo-profile-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  GYM_DEMO_PROFILE_JOURNAL_NAMESPACE,
  GYM_DEMO_PROFILE_JOURNAL_VERSION,
  acknowledgeGymDemoProfileGroupDetach,
  createGymDemoProfileJournalFixture,
  effectsMatchPreparedCommand,
  getValidatedGymDemoProfileJournal,
  prepareGymDemoProfileJournalCommand,
  stageGymDemoProfileJournal,
} from "./gym-demo-profile-journal.ts";

const admin = getGymDemoProfileActorToken(GYM_DEMO_ADMIN_ID);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function profileRow(state, id) {
  const row = state.students.find((student) => student.id === id);
  assert.ok(row, `missing ${id}`);
  return row;
}

/** Convenience for tests: prepare against `journal`, then stage on the very same journal. */
function stageCommand(journal, command) {
  const prepared = prepareGymDemoProfileJournalCommand(journal, command);
  if (!prepared.success) return { success: false, journal: prepared.journal, error: prepared.error };
  return stageGymDemoProfileJournal(journal, prepared.ticket);
}

function generalCommand(studentId) {
  return { type: "SET_TYPE", actorToken: admin, input: { studentId, studentType: "GENERAL" } };
}

test("the initial journal wraps the approved core profile fixture at revision zero and stays byte-stable", () => {
  const journal = createGymDemoProfileJournalFixture();
  assert.deepEqual(journal, {
    namespace: GYM_DEMO_PROFILE_JOURNAL_NAMESPACE,
    version: GYM_DEMO_PROFILE_JOURNAL_VERSION,
    revision: 0,
    profileState: createGymDemoProfileFixture(),
    pendingGroupDetaches: [],
  });
  const bytes = JSON.stringify(journal);
  const restored = getValidatedGymDemoProfileJournal(JSON.parse(bytes));
  assert.ok(restored);
  assert.equal(JSON.stringify(restored), bytes);
  assert.notEqual(restored, journal);
  assert.notEqual(restored.profileState, journal.profileState);
});

test("a successful GENERAL core transition stages one detached pending intent and repeated detaches supersede stale acknowledgements", () => {
  const initial = createGymDemoProfileJournalFixture();
  const command = generalCommand(GYM_DEMO_PERSONALIZED_STUDENT_ID);
  const first = stageCommand(initial, command);
  assert.equal(first.success, true);
  assert.equal(first.journal.revision, 1);
  assert.deepEqual(first.journal.pendingGroupDetaches, [{ studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, revision: 1 }]);

  const second = stageCommand(first.journal, command);
  assert.equal(second.success, true, "the core deliberately emits a new detach when GENERAL is selected again");
  assert.equal(second.journal.revision, 2);
  assert.deepEqual(second.journal.pendingGroupDetaches, [{ studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, revision: 2 }]);
  const stale = acknowledgeGymDemoProfileGroupDetach(second.journal, GYM_DEMO_PERSONALIZED_STUDENT_ID, 1);
  assert.equal(stale.success, false);
  assert.equal(stale.journal, second.journal);
  const acknowledged = acknowledgeGymDemoProfileGroupDetach(second.journal, GYM_DEMO_PERSONALIZED_STUDENT_ID, 2);
  assert.equal(acknowledged.success, true);
  assert.deepEqual(acknowledged.journal.pendingGroupDetaches, []);
  assert.equal(acknowledged.journal.revision, 2);
});

test("pending detach intent survives later unrelated metadata and a later PERSONALIZED type until an exact acknowledgement", () => {
  const initial = createGymDemoProfileJournalFixture();
  const staged = stageCommand(initial, generalCommand(GYM_DEMO_PERSONALIZED_STUDENT_ID));
  assert.equal(staged.success, true);
  const afterName = stageCommand(staged.journal, {
    type: "EDIT_STUDENT",
    actorToken: admin,
    input: { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "Otro cambio" },
  });
  assert.equal(afterName.success, true);
  const afterPersonalized = stageCommand(afterName.journal, {
    type: "SET_TYPE",
    actorToken: admin,
    input: { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, studentType: "PERSONALIZED" },
  });
  assert.equal(afterPersonalized.success, true);
  assert.equal(profileRow(afterPersonalized.journal.profileState, GYM_DEMO_PERSONALIZED_STUDENT_ID).studentType, "PERSONALIZED");
  assert.deepEqual(afterPersonalized.journal.pendingGroupDetaches, [{ studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, revision: 1 }]);
});

test("staging rejects a ticket whose base journal has since advanced, without rolling back the newer metadata (finding 1)", () => {
  const initial = createGymDemoProfileJournalFixture();
  const staleCommand = generalCommand(GYM_DEMO_PERSONALIZED_STUDENT_ID);
  const stalePrep = prepareGymDemoProfileJournalCommand(initial, staleCommand);
  assert.equal(stalePrep.success, true);

  const renamed = stageCommand(initial, {
    type: "EDIT_STUDENT",
    actorToken: admin,
    input: { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "Nombre nuevo" },
  });
  assert.equal(renamed.success, true);
  assert.equal(renamed.journal.revision, 1);

  const staleStage = stageGymDemoProfileJournal(renamed.journal, stalePrep.ticket);
  assert.equal(staleStage.success, false);
  assert.equal(staleStage.journal, renamed.journal, "the advanced journal must not be rolled back by the stale ticket");
  assert.equal(profileRow(staleStage.journal.profileState, GYM_DEMO_GENERAL_STUDENT_ID).name, "Nombre nuevo");

  // A ticket is single-use: staging it once against its true base consumes it; replay must fail too.
  const freshPrep = prepareGymDemoProfileJournalCommand(initial, staleCommand);
  const consumed = stageGymDemoProfileJournal(initial, freshPrep.ticket);
  assert.equal(consumed.success, true);
  const replay = stageGymDemoProfileJournal(initial, freshPrep.ticket);
  assert.equal(replay.success, false);
  assert.equal(replay.journal, initial);
});

test("a GENERAL reselect that flips canCreateOwnRoutines from true to false is staged, not rejected (finding 2)", () => {
  const initial = createGymDemoProfileJournalFixture();
  // The last-teacher-removal quirk enables own routines for any FULL type once fully unlinked.
  const unassigned = stageCommand(initial, {
    type: "UNASSIGN_TEACHER",
    actorToken: admin,
    input: { teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_GENERAL_STUDENT_ID },
  });
  assert.equal(unassigned.success, true);
  assert.equal(profileRow(unassigned.journal.profileState, GYM_DEMO_GENERAL_STUDENT_ID).canCreateOwnRoutines, true);

  const reselected = stageCommand(unassigned.journal, generalCommand(GYM_DEMO_GENERAL_STUDENT_ID));
  assert.equal(reselected.success, true, "a valid GENERAL reselect with an own-routines true -> false flip must not be rejected");
  assert.equal(profileRow(reselected.journal.profileState, GYM_DEMO_GENERAL_STUDENT_ID).canCreateOwnRoutines, false);
  assert.deepEqual(reselected.journal.pendingGroupDetaches.map((intent) => intent.studentId), [GYM_DEMO_GENERAL_STUDENT_ID]);
});

test("prepare rejects denied and hostile commands without invoking untrusted getters, retaining the original journal identity", () => {
  const initial = createGymDemoProfileJournalFixture();

  const denied = prepareGymDemoProfileJournalCommand(initial, {
    type: "SET_TYPE",
    actorToken: null,
    input: { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, studentType: "GENERAL" },
  });
  assert.equal(denied.success, false);
  assert.equal(denied.journal, initial);
  assert.equal(denied.ticket, null);
  assert.equal(stageGymDemoProfileJournal(initial, denied.ticket).success, false);

  const forged = prepareGymDemoProfileJournalCommand(initial, {
    ...generalCommand(GYM_DEMO_PERSONALIZED_STUDENT_ID),
    extra: true,
  });
  assert.equal(forged.success, false);
  assert.equal(forged.journal, initial);

  let reads = 0;
  const hostile = new Proxy({}, {
    get() { reads += 1; throw new Error("must not get"); },
    ownKeys() { return ["type", "actorToken", "input"]; },
    getOwnPropertyDescriptor(_target, key) {
      if (key === "type") return { value: "SET_TYPE", enumerable: true, configurable: true };
      if (key === "actorToken") return { value: admin, enumerable: true, configurable: true };
      return { get() { throw new Error("must not invoke getter"); }, enumerable: true, configurable: true };
    },
  });
  const hostileResult = prepareGymDemoProfileJournalCommand(initial, hostile);
  assert.equal(hostileResult.success, false);
  assert.equal(hostileResult.journal, initial);
  assert.equal(reads, 0);
});

test("stage rejects a revision at the safe-integer ceiling", () => {
  const initial = createGymDemoProfileJournalFixture();
  const overflow = clone(initial);
  overflow.revision = Number.MAX_SAFE_INTEGER;
  const overflowJournal = getValidatedGymDemoProfileJournal(overflow);
  assert.ok(overflowJournal);

  const prepared = prepareGymDemoProfileJournalCommand(overflowJournal, generalCommand(GYM_DEMO_PERSONALIZED_STUDENT_ID));
  assert.equal(prepared.success, true);
  assert.equal(stageGymDemoProfileJournal(overflowJournal, prepared.ticket).success, false);
});

test("validation preserves core metadata exactly but rejects invalid, rollover, offset, and noncanonical blocked timestamps", () => {
  const initial = createGymDemoProfileJournalFixture();
  const staged = stageCommand(initial, {
    type: "SET_BLOCKED",
    actorToken: admin,
    input: { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: true },
    clock: () => "2030-06-03T12:00:00.000Z",
  });
  assert.equal(staged.success, true);
  assert.equal(profileRow(staged.journal.profileState, GYM_DEMO_GENERAL_STUDENT_ID).blockedAt, "2030-06-03T12:00:00.000Z");

  for (const blockedAt of ["2030-02-30T12:00:00.000Z", "2030-06-03T09:00:00.000-03:00", "", "2030-06-03T12:00:00Z"]) {
    const candidate = clone(initial);
    profileRow(candidate.profileState, GYM_DEMO_GENERAL_STUDENT_ID).blockedAt = blockedAt;
    assert.equal(getValidatedGymDemoProfileJournal(candidate), null, blockedAt);
  }
});

test("journal snapshots guard the exact root header before children, accept frozen graphs, and make no source get/toJSON reads", () => {
  const valid = createGymDemoProfileJournalFixture();
  const frozen = Object.freeze({
    ...valid,
    profileState: Object.freeze({
      ...valid.profileState,
      students: Object.freeze(valid.profileState.students.map((student) => Object.freeze({ ...student }))),
      links: Object.freeze(valid.profileState.links.map((link) => Object.freeze({ ...link }))),
    }),
    pendingGroupDetaches: Object.freeze([]),
  });
  assert.ok(getValidatedGymDemoProfileJournal(frozen));

  let childCalls = 0;
  const foreign = new Proxy({ ...valid, profileState: new Proxy({}, { ownKeys() { childCalls += 1; throw new Error("child"); } }) }, {
    getOwnPropertyDescriptor(target, key) {
      if (key === "namespace") return { value: "foreign", enumerable: true, configurable: true };
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  assert.equal(getValidatedGymDemoProfileJournal(foreign), null);
  assert.equal(childCalls, 0);

  let gets = 0;
  const safe = new Proxy(valid, {
    get() { gets += 1; throw new Error("ordinary get/toJSON is forbidden"); },
    ownKeys(target) { return Reflect.ownKeys(target); },
    getOwnPropertyDescriptor(target, key) { return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  assert.ok(getValidatedGymDemoProfileJournal(safe));
  assert.equal(gets, 0);

  let keyRounds = 0;
  const drifting = new Proxy(valid, {
    ownKeys(target) {
      keyRounds += 1;
      return keyRounds === 1 ? Reflect.ownKeys(target) : [...Reflect.ownKeys(target), "late"];
    },
    getOwnPropertyDescriptor(target, key) {
      return key === "late" ? { value: true, enumerable: true, configurable: true } : Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  assert.equal(getValidatedGymDemoProfileJournal(drifting), null);
  assert.equal(keyRounds, 2);
});

test("closed journal shapes reject symbols, hidden keys, accessors, prototypes, sparse arrays, cycles, and duplicate intents", () => {
  const valid = createGymDemoProfileJournalFixture();
  const symbol = clone(valid); symbol[Symbol("extra")] = true;
  const hidden = clone(valid); Object.defineProperty(hidden, "hidden", { value: true });
  const accessor = clone(valid); Object.defineProperty(accessor, "revision", { enumerable: true, get() { throw new Error("getter"); } });
  const prototype = Object.assign(Object.create({ inherited: true }), valid);
  const sparse = clone(valid); sparse.pendingGroupDetaches = new Array(1);
  const cyclic = clone(valid); cyclic.self = cyclic;
  const duplicate = clone(valid); duplicate.revision = 1; duplicate.pendingGroupDetaches = [
    { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, revision: 1 },
    { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, revision: 1 },
  ];
  for (const candidate of [symbol, hidden, accessor, prototype, sparse, cyclic, duplicate]) assert.equal(getValidatedGymDemoProfileJournal(candidate), null);
});

// R3-001: `clock` is now a genuinely required own key on a SET_BLOCKED command (its value may still be
// `undefined`). These two tests document the decided direction and its runtime parity in both cases.
test("R3-001: a SET_BLOCKED command that omits the clock own key is rejected as an invalid command", () => {
  const initial = createGymDemoProfileJournalFixture();
  const withoutClockKey = { type: "SET_BLOCKED", actorToken: admin, input: { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: false } };
  assert.equal(Reflect.ownKeys(withoutClockKey).includes("clock"), false);
  const prepared = prepareGymDemoProfileJournalCommand(initial, withoutClockKey);
  assert.equal(prepared.success, false);
  assert.equal(prepared.journal, initial);
});

test("R3-001: a SET_BLOCKED command with clock explicitly undefined is accepted when unblocking needs no clock", () => {
  const initial = createGymDemoProfileJournalFixture();
  const staged = stageCommand(initial, {
    type: "SET_BLOCKED",
    actorToken: admin,
    input: { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: false },
    clock: undefined,
  });
  assert.equal(staged.success, true);
  assert.equal(profileRow(staged.journal.profileState, GYM_DEMO_GENERAL_STUDENT_ID).blockedAt, null);
});

// R3-002: journal-level coverage for the three previously untested dispatch arms.
test("R3-002: stages a SET_PAYMENT_EXEMPT command", () => {
  const initial = createGymDemoProfileJournalFixture();
  const staged = stageCommand(initial, {
    type: "SET_PAYMENT_EXEMPT",
    actorToken: admin,
    input: { studentId: GYM_DEMO_GENERAL_STUDENT_ID, exempt: true, reason: "Beca deportiva" },
  });
  assert.equal(staged.success, true);
  const row = profileRow(staged.journal.profileState, GYM_DEMO_GENERAL_STUDENT_ID);
  assert.equal(row.paymentExempt, true);
  assert.equal(row.paymentExemptReason, "Beca deportiva");
  assert.deepEqual(staged.journal.pendingGroupDetaches, []);
});

test("R3-002: stages a SET_OWN_ROUTINES command", () => {
  const initial = createGymDemoProfileJournalFixture();
  const staged = stageCommand(initial, {
    type: "SET_OWN_ROUTINES",
    actorToken: admin,
    input: { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, canCreateOwnRoutines: true },
  });
  assert.equal(staged.success, true);
  assert.equal(profileRow(staged.journal.profileState, GYM_DEMO_PERSONALIZED_STUDENT_ID).canCreateOwnRoutines, true);
});

test("R3-002: stages an ASSIGN_TEACHER command", () => {
  const initial = createGymDemoProfileJournalFixture();
  const staged = stageCommand(initial, {
    type: "ASSIGN_TEACHER",
    actorToken: admin,
    input: { teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, studentId: GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID },
  });
  assert.equal(staged.success, true);
  assert.ok(staged.journal.profileState.links.some(
    (link) => link.teacherId === GYM_DEMO_SECONDARY_TEACHER_ID && link.studentId === GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
  ));
});

test("R3-002: prepare passes through an authorized core business failure instead of a generic invalid-command error", () => {
  const initial = createGymDemoProfileJournalFixture();
  // GYM_DEMO_PERSONALIZED_STUDENT_ID is already linked to GYM_DEMO_PRIMARY_TEACHER_ID in the canonical fixture.
  const duplicate = prepareGymDemoProfileJournalCommand(initial, {
    type: "ASSIGN_TEACHER",
    actorToken: admin,
    input: { teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID },
  });
  assert.equal(duplicate.success, false);
  assert.equal(duplicate.journal, initial);
  assert.equal(duplicate.error, "Ese alumno ya está asignado a ese profe.");
});

test("R3-002: effectsMatchPreparedCommand rejects a hand-built ticket whose effect does not correspond to an actual GENERAL transition", () => {
  const fixture = createGymDemoProfileFixture();
  // Through the real, approved core this mismatch cannot occur; this ticket is hand-built specifically
  // to exercise the rejection branch, since prepare's captured tickets are always self-consistent.
  const mismatched = {
    baseRevision: 0,
    baseProfileState: fixture,
    transition: {
      state: fixture,
      result: { success: true },
      effects: [{ type: "DETACH_ALL_GROUPS", studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID }],
    },
  };
  assert.equal(profileRow(fixture, GYM_DEMO_PERSONALIZED_STUDENT_ID).studentType, "PERSONALIZED");
  assert.equal(effectsMatchPreparedCommand(mismatched), false);
});
