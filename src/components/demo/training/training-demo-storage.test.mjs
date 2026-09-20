import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingDemoFixture } from "./training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteTrainingGroup, selectTrainingDemoActor } from "./training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  isValidTrainingDemoState,
  loadTrainingDemoState,
  persistTrainingDemoState,
  resolveTrainingDemoInitialState,
  restoreTrainingDemoState,
  serializeTrainingDemoState,
} from "./training-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { TRAINING_DEMO_STORAGE_KEY } from "./training-demo-types.ts";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("strict storage round-trips valid detached GROUP history at a fixed point", () => {
  let state = createTrainingDemoFixture();
  state = selectTrainingDemoActor(state, "t1").state;
  state = deleteTrainingGroup(state, "g1", "2025-05-01T10:00:00.000Z").state;
  assert.equal(isValidTrainingDemoState(state), true);
  const serialized = serializeTrainingDemoState(state);
  assert.deepEqual(restoreTrainingDemoState(serialized), state);
  assert.equal(serializeTrainingDemoState(restoreTrainingDemoState(serialized)), serialized);
});

test("unknown versions, corrupt JSON, and nested reference corruption reset to fixtures", () => {
  const fixture = createTrainingDemoFixture();
  const versionMismatch = clone(fixture);
  versionMismatch.version = 999;
  const danglingMember = clone(fixture);
  danglingMember.memberships[0].studentId = "external-student";
  const incoherentTarget = clone(fixture);
  incoherentTarget.wods[2].targetGroupId = "g2";
  const duplicateIds = clone(fixture);
  duplicateIds.wods.push(clone(duplicateIds.wods[0]));
  const deletedMember = clone(fixture);
  deletedMember.groups[0].deletedAt = "2025-05-01T10:00:00.000Z";
  const studentBroadcast = clone(fixture);
  studentBroadcast.wods[5].targetType = "ALL";
  studentBroadcast.wods[5].targetStudentId = null;
  const studentPersonalized = clone(fixture);
  studentPersonalized.wods[5].targetType = "PERSONALIZED";
  studentPersonalized.wods[5].targetStudentId = null;
  const studentGroup = clone(fixture);
  studentGroup.wods[5].targetType = "GROUP";
  studentGroup.wods[5].targetGroupId = "g2";
  studentGroup.wods[5].targetStudentId = null;
  const studentForeign = clone(fixture);
  studentForeign.wods[5].targetStudentId = "s1";
  for (const candidate of [versionMismatch, danglingMember, incoherentTarget, duplicateIds, deletedMember, studentBroadcast, studentPersonalized, studentGroup, studentForeign]) {
    assert.equal(isValidTrainingDemoState(candidate), false);
    assert.deepEqual(restoreTrainingDemoState(JSON.stringify(candidate)), fixture);
  }
  assert.deepEqual(restoreTrainingDemoState("{not json"), fixture);
});

test("initial resolution gives valid persisted state precedence and validates its fallback", () => {
  const fallback = clone(createTrainingDemoFixture());
  fallback.selectedActorId = "s1";
  const stored = clone(createTrainingDemoFixture());
  stored.selectedActorId = "t1";
  assert.deepEqual(resolveTrainingDemoInitialState(JSON.stringify(stored), fallback), { state: stored, warning: null });
  assert.deepEqual(resolveTrainingDemoInitialState(null, fallback), { state: fallback, warning: null });
  const corrupt = resolveTrainingDemoInitialState("{not json", fallback);
  assert.deepEqual(corrupt.state, fallback);
  assert.match(corrupt.warning ?? "", /no es válido/i);
  assert.deepEqual(resolveTrainingDemoInitialState(null, { selectedActorId: "s1" }).state, createTrainingDemoFixture());
});

test("storage failures continue in memory with a warning and reset to supplied fixtures", () => {
  const fallback = clone(createTrainingDemoFixture());
  fallback.selectedActorId = "s1";
  const unavailable = loadTrainingDemoState(null, fallback);
  assert.deepEqual(unavailable.state, fallback);
  assert.match(unavailable.warning ?? "", /no está disponible/i);

  const throwing = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  const loaded = loadTrainingDemoState(throwing);
  assert.deepEqual(loaded.state, createTrainingDemoFixture());
  assert.match(loaded.warning ?? "", /No se pudo leer/i);
  assert.match(persistTrainingDemoState(throwing, createTrainingDemoFixture()) ?? "", /No se pudieron guardar/i);
});

test("valid storage is restored and persistence uses only the versioned training key", () => {
  const stored = new Map();
  const storage = {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) { stored.set(key, value); },
  };
  const fixture = createTrainingDemoFixture();
  assert.equal(persistTrainingDemoState(storage, fixture), null);
  assert.equal(stored.size, 1);
  assert.ok(stored.has(TRAINING_DEMO_STORAGE_KEY));
  assert.deepEqual(loadTrainingDemoState(storage), { state: fixture, warning: null });
});
