import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_MUSLIB_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
} from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoProfileActorToken } from "./gym-demo-profile-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymDemoProfileJournalFixture, prepareGymDemoProfileJournalCommand, stageGymDemoProfileJournal } from "./gym-demo-profile-journal.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "../training/gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { applyGymDemoProfileCommand, reconcileGymDemoProfilePendingGroupDetaches } from "./gym-demo-profile-coordinator.ts";

const admin = getGymDemoProfileActorToken(GYM_DEMO_ADMIN_ID);
const secondaryTeacher = getGymDemoProfileActorToken(GYM_DEMO_SECONDARY_TEACHER_ID);

function generalCommand(actorToken, studentId) {
  return { type: "SET_TYPE", actorToken, input: { studentId, studentType: "GENERAL" } };
}

function editCommand(actorToken, studentId, name) {
  return { type: "EDIT_STUDENT", actorToken, input: { studentId, name } };
}

/** A plain getItem/setItem spy. `failOnCall` (1-based) makes one specific setItem call throw. */
function storageSpy(tag, sharedLog = [], failOnCall = null) {
  const values = new Map();
  let calls = 0;
  return {
    log: sharedLog,
    storage: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) {
        calls += 1;
        if (calls === failOnCall) { sharedLog.push([tag, "failed"]); throw new Error("quota exceeded"); }
        sharedLog.push([tag, "wrote"]);
        values.set(key, value);
      },
    },
  };
}

function membershipExists(trainingState, studentId, groupId) {
  return trainingState.memberships.some((membership) => membership.studentId === studentId && membership.groupId === groupId);
}

/** Convenience for building a journal with a chosen number of pending intents, mirroring journal.ts's own tests. */
function stageCommand(journal, command) {
  const prepared = prepareGymDemoProfileJournalCommand(journal, command);
  assert.equal(prepared.success, true);
  const staged = stageGymDemoProfileJournal(journal, prepared.ticket);
  assert.equal(staged.success, true);
  return staged.journal;
}

test("applies a GENERAL command end to end: journal is persisted before the training-ledger write, and the pruned membership is fully acknowledged", () => {
  const sharedLog = [];
  const profile = storageSpy("profile", sharedLog);
  const training = storageSpy("training", sharedLog);
  const journal = createGymDemoProfileJournalFixture();
  const trainingState = createGymTrainingDemoFixture();
  assert.ok(membershipExists(trainingState, GYM_DEMO_PERSONALIZED_STUDENT_ID, "gym-dated-group-strength"));

  const outcome = applyGymDemoProfileCommand(
    { profileStorage: profile.storage, trainingStorage: training.storage },
    journal,
    trainingState,
    generalCommand(admin, GYM_DEMO_PERSONALIZED_STUDENT_ID),
  );

  assert.equal(outcome.success, true);
  assert.equal(outcome.warning, null);
  assert.deepEqual(outcome.resolvedStudentIds, [GYM_DEMO_PERSONALIZED_STUDENT_ID]);
  assert.deepEqual(outcome.pendingStudentIds, []);
  assert.deepEqual(outcome.journal.pendingGroupDetaches, []);
  assert.equal(membershipExists(outcome.trainingState, GYM_DEMO_PERSONALIZED_STUDENT_ID, "gym-dated-group-strength"), false);

  // Ordering invariant: the very first write of the whole call is the journal (with the pending intent),
  // strictly before the first training-ledger write.
  const firstProfileWrite = sharedLog.findIndex(([tag]) => tag === "profile");
  const firstTrainingWrite = sharedLog.findIndex(([tag]) => tag === "training");
  assert.notEqual(firstProfileWrite, -1);
  assert.notEqual(firstTrainingWrite, -1);
  assert.ok(firstProfileWrite < firstTrainingWrite, `expected profile write (${firstProfileWrite}) before training write (${firstTrainingWrite})`);
});

test("a command with no group-detach effect never writes to the training ledger", () => {
  const sharedLog = [];
  const profile = storageSpy("profile", sharedLog);
  const training = storageSpy("training", sharedLog);
  const journal = createGymDemoProfileJournalFixture();
  const trainingState = createGymTrainingDemoFixture();

  const outcome = applyGymDemoProfileCommand(
    { profileStorage: profile.storage, trainingStorage: training.storage },
    journal,
    trainingState,
    editCommand(admin, GYM_DEMO_PERSONALIZED_STUDENT_ID, "Nuevo nombre"),
  );

  assert.equal(outcome.success, true);
  assert.deepEqual(outcome.resolvedStudentIds, []);
  assert.deepEqual(outcome.pendingStudentIds, []);
  assert.equal(sharedLog.some(([tag]) => tag === "training"), false, "no group-affecting command must never touch the training ledger");
  assert.equal(sharedLog.filter(([tag]) => tag === "profile").length, 1);
});

test("a denied command writes to neither ledger", () => {
  const sharedLog = [];
  const profile = storageSpy("profile", sharedLog);
  const training = storageSpy("training", sharedLog);
  const journal = createGymDemoProfileJournalFixture();
  const trainingState = createGymTrainingDemoFixture();

  const outcome = applyGymDemoProfileCommand(
    { profileStorage: profile.storage, trainingStorage: training.storage },
    journal,
    trainingState,
    generalCommand(null, GYM_DEMO_PERSONALIZED_STUDENT_ID),
  );

  assert.equal(outcome.success, false);
  assert.equal(sharedLog.length, 0);
  assert.equal(outcome.trainingState, trainingState);
});

test("the system admin actor prunes memberships across groups owned by a different teacher than the invoking actor", () => {
  const journal = createGymDemoProfileJournalFixture();
  const baseTraining = createGymTrainingDemoFixture();
  // gym-dated-group-strength is owned by the primary teacher; this second membership is owned by the
  // secondary teacher, who is also the actor issuing the command below and owns neither group.
  const trainingState = {
    ...baseTraining,
    memberships: [...baseTraining.memberships, { groupId: "gym-dated-group-mobility", studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID }],
  };
  assert.ok(membershipExists(trainingState, GYM_DEMO_PERSONALIZED_STUDENT_ID, "gym-dated-group-strength"));
  assert.ok(membershipExists(trainingState, GYM_DEMO_PERSONALIZED_STUDENT_ID, "gym-dated-group-mobility"));

  const profile = storageSpy("profile");
  const training = storageSpy("training");
  const outcome = applyGymDemoProfileCommand(
    { profileStorage: profile.storage, trainingStorage: training.storage },
    journal,
    trainingState,
    generalCommand(secondaryTeacher, GYM_DEMO_PERSONALIZED_STUDENT_ID),
  );

  assert.equal(outcome.success, true);
  assert.deepEqual(outcome.resolvedStudentIds, [GYM_DEMO_PERSONALIZED_STUDENT_ID]);
  assert.equal(outcome.trainingState.memberships.some((membership) => membership.studentId === GYM_DEMO_PERSONALIZED_STUDENT_ID), false);
});

test("partial durability: a training-ledger write failure for one pending student warns, keeps that student pending, and never rolls back the other student's already-landed write; a later pass converges without resurrecting", () => {
  const initial = createGymDemoProfileJournalFixture();
  const withFirst = stageCommand(initial, generalCommand(admin, GYM_DEMO_PERSONALIZED_STUDENT_ID));
  const withBoth = stageCommand(withFirst, generalCommand(admin, GYM_DEMO_MUSLIB_STUDENT_ID));
  assert.deepEqual(withBoth.pendingGroupDetaches.map((intent) => intent.studentId), [GYM_DEMO_PERSONALIZED_STUDENT_ID, GYM_DEMO_MUSLIB_STUDENT_ID]);

  const trainingState = createGymTrainingDemoFixture();
  const profile = storageSpy("profile");
  // The second setItem call is this student's training write; make exactly that one fail.
  const training = storageSpy("training", [], 2);

  const first = reconcileGymDemoProfilePendingGroupDetaches(
    { profileStorage: profile.storage, trainingStorage: training.storage },
    withBoth,
    trainingState,
  );

  assert.deepEqual(first.resolvedStudentIds, [GYM_DEMO_PERSONALIZED_STUDENT_ID]);
  assert.deepEqual(first.pendingStudentIds, [GYM_DEMO_MUSLIB_STUDENT_ID]);
  assert.equal(typeof first.warning, "string");
  assert.deepEqual(first.journal.pendingGroupDetaches.map((intent) => intent.studentId), [GYM_DEMO_MUSLIB_STUDENT_ID]);
  // The first student's already-landed prune is not rolled back.
  assert.equal(membershipExists(first.trainingState, GYM_DEMO_PERSONALIZED_STUDENT_ID, "gym-dated-group-strength"), false);
  // The second student's membership is untouched (write never landed): neither pruned nor resurrected.
  assert.ok(membershipExists(first.trainingState, GYM_DEMO_MUSLIB_STUDENT_ID, "gym-dated-group-strength"));

  // A later pass, once storage is healthy again, resolves only the still-pending student.
  const healthyTraining = storageSpy("training-retry");
  const second = reconcileGymDemoProfilePendingGroupDetaches(
    { profileStorage: profile.storage, trainingStorage: healthyTraining.storage },
    first.journal,
    first.trainingState,
  );
  assert.deepEqual(second.resolvedStudentIds, [GYM_DEMO_MUSLIB_STUDENT_ID]);
  assert.deepEqual(second.pendingStudentIds, []);
  assert.equal(second.warning, null);
  assert.deepEqual(second.journal.pendingGroupDetaches, []);
  assert.equal(membershipExists(second.trainingState, GYM_DEMO_MUSLIB_STUDENT_ID, "gym-dated-group-strength"), false);

  // A fully-resolved journal is a true no-op: no writes, and the same object references pass through.
  const thirdLog = [];
  const idleStorage = storageSpy("idle", thirdLog);
  const third = reconcileGymDemoProfilePendingGroupDetaches(
    { profileStorage: idleStorage.storage, trainingStorage: idleStorage.storage },
    second.journal,
    second.trainingState,
  );
  assert.deepEqual(third.resolvedStudentIds, []);
  assert.deepEqual(third.pendingStudentIds, []);
  assert.equal(third.warning, null);
  assert.equal(third.journal, second.journal);
  assert.equal(third.trainingState, second.trainingState);
  assert.equal(thirdLog.length, 0);
});

test("a failed stage write skips the training prune entirely and does not claim success", () => {
  // Start from a journal that already carries one pending detach, so a "previous state returned
  // unchanged" assertion is actually meaningful (not indistinguishable from an empty default).
  const withFirst = stageCommand(createGymDemoProfileJournalFixture(), generalCommand(admin, GYM_DEMO_MUSLIB_STUDENT_ID));
  const trainingState = createGymTrainingDemoFixture();
  const trainingLog = [];
  const training = storageSpy("training", trainingLog);
  // The staged-journal write is the first (and, if reconcile incorrectly ran, only) profile setItem call.
  const profile = storageSpy("profile", [], 1);

  const outcome = applyGymDemoProfileCommand(
    { profileStorage: profile.storage, trainingStorage: training.storage },
    withFirst,
    trainingState,
    generalCommand(admin, GYM_DEMO_PERSONALIZED_STUDENT_ID),
  );

  assert.equal(outcome.success, false);
  assert.equal(typeof outcome.error, "string");
  assert.equal(outcome.warning, null);
  // Zero training-ledger reads/writes: reconcile must never run once the stage write itself failed.
  assert.equal(trainingLog.length, 0, "no training-ledger write may occur when the staged journal never became durable");
  // In-memory state stays exactly what storage still holds, not the staged (unpersisted) journal.
  assert.deepEqual(outcome.journal, withFirst);
  assert.deepEqual(outcome.journal.pendingGroupDetaches.map((intent) => intent.studentId), [GYM_DEMO_MUSLIB_STUDENT_ID]);
  assert.equal(outcome.trainingState, trainingState);
});

test("the acknowledgement is only persisted after the training-ledger prune is durable: a journal-write failure leaves the intent pending without rolling back the already-landed prune, and a later retry never re-writes the unchanged training ledger", () => {
  const journal = stageCommand(createGymDemoProfileJournalFixture(), generalCommand(admin, GYM_DEMO_PERSONALIZED_STUDENT_ID));
  const trainingState = createGymTrainingDemoFixture();
  const trainingLog = [];
  const training = storageSpy("training", trainingLog);
  // The one profile-storage write this reconcile pass attempts is the acknowledgement; make it fail.
  const profile = storageSpy("profile", [], 1);

  const first = reconcileGymDemoProfilePendingGroupDetaches(
    { profileStorage: profile.storage, trainingStorage: training.storage },
    journal,
    trainingState,
  );

  assert.deepEqual(first.resolvedStudentIds, []);
  assert.deepEqual(first.pendingStudentIds, [GYM_DEMO_PERSONALIZED_STUDENT_ID]);
  assert.equal(typeof first.warning, "string");
  // The prune already landed durably and is not rolled back, even though its acknowledgement did not persist.
  assert.equal(membershipExists(first.trainingState, GYM_DEMO_PERSONALIZED_STUDENT_ID, "gym-dated-group-strength"), false);
  assert.deepEqual(first.journal.pendingGroupDetaches.map((intent) => intent.studentId), [GYM_DEMO_PERSONALIZED_STUDENT_ID]);
  assert.equal(trainingLog.length, 1, "the training ledger was written exactly once");

  const healthyProfile = storageSpy("profile-retry");
  const second = reconcileGymDemoProfilePendingGroupDetaches(
    { profileStorage: healthyProfile.storage, trainingStorage: training.storage },
    first.journal,
    first.trainingState,
  );
  assert.deepEqual(second.resolvedStudentIds, [GYM_DEMO_PERSONALIZED_STUDENT_ID]);
  assert.deepEqual(second.journal.pendingGroupDetaches, []);
  // The retry's prune step is a pure no-op (membership was already gone): no additional training write.
  assert.equal(trainingLog.length, 1, "a retry must not re-write an already-durable, unchanged training ledger");
});
