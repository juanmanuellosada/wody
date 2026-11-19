import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedDemoFixture } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteGymTrainingGroup } from "./gym-training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymFixedDemoActor, getGymFixedDemoActorToken } from "./gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedCallbackFactory } from "./gym-fixed-demo-adapters.ts";

const NOW = "2025-05-10T14:30:00.000Z";
const token = (id) => { const value = getGymFixedDemoActorToken(id); assert.ok(value); return value; };
function setup(overrides = {}) {
  let current = createGymFixedDemoFixture(); let currentTraining = createGymTrainingDemoFixture(); const commits = [];
  const callbacks = createGymFixedCallbackFactory({ getState: () => current, getTrainingState: () => currentTraining, commit: (state) => { current = state; commits.push(state); }, fixedActorToken: token("gym-fixed-teacher-linked"), now: () => new Date(NOW), ...overrides });
  return { callbacks, commits, get current() { return current; }, set current(value) { current = value; }, get training() { return currentTraining; }, set training(value) { currentTraining = value; } };
}

test("adapter preserves five callback signatures with required dated context", async () => {
  const demo = setup();
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", " A ", " B "), { success: true, id: "gym-fixed-local-1" });
  assert.deepEqual(await demo.callbacks.onUpdateFixedRoutine("gym-fixed-local-1", " Edit ", " Body ", ""), { success: true });
  assert.deepEqual(await demo.callbacks.onUpdateFixedRoutineRenewAt("gym-fixed-local-1", new Date("2025-06-12T18:00:00.000Z")), { success: true });
  assert.deepEqual(await demo.callbacks.onDeleteFixedRoutine("gym-fixed-local-1"), { success: true });
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutineForGroup("gym-dated-group-strength", " Group ", " Plan "), { success: true, count: 2 });
  assert.equal(demo.commits.length, 5);
});

test("group callback preserves scope, field, then eligibility errors without IDs, clocks, or commits", async () => {
  let idReads = 0;
  let clockReads = 0;
  const demo = setup({ nextId: () => { idReads += 1; return "must-not-allocate"; }, now: () => { clockReads += 1; return new Date(NOW); } });
  const expectFailure = async (groupId, title, content, error) => {
    assert.deepEqual(await demo.callbacks.onCreateFixedRoutineForGroup(groupId, title, content), { success: false, error });
    assert.equal(idReads, 0);
    assert.equal(clockReads, 0);
    assert.equal(demo.commits.length, 0);
  };
  demo.training = { ...demo.training, memberships: [] };
  await expectFailure("gym-dated-group-strength", "", "Body", "El título es obligatorio.");
  await expectFailure("gym-dated-group-strength", "   ", "Body", "El título es obligatorio.");
  await expectFailure("gym-dated-group-strength", "Title", "", "El contenido es obligatorio.");
  await expectFailure("gym-dated-group-strength", "Title", "  ", "El contenido es obligatorio.");
  await expectFailure("gym-dated-group-strength", "", "", "El título es obligatorio.");
  await expectFailure("gym-dated-group-strength", "Title", "Body", "El grupo no tiene alumnos de musculación libre.");
  demo.training = createGymTrainingDemoFixture();
  await expectFailure("gym-dated-group-strength", "", "Body", "El título es obligatorio.");
  await expectFailure("gym-dated-group-strength", "Title", "  ", "El contenido es obligatorio.");
  await expectFailure("missing", "", "", "Grupo no encontrado.");
  await expectFailure("gym-dated-group-mobility", "", "", "No autorizado para este grupo.");
  demo.training = deleteGymTrainingGroup(demo.training, token("gym-fixed-teacher-linked"), "gym-dated-group-strength", NOW).state;
  await expectFailure("gym-dated-group-strength", "", "", "Grupo no encontrado.");
});

test("queued group execution captures fresh membership once before allocation and commit", async () => {
  const demo = setup();
  demo.training = { ...demo.training, memberships: demo.training.memberships.filter((member) => member.studentId !== "gym-fixed-student-muslib") };
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutineForGroup("gym-dated-group-strength", "Group", "Plan"), { success: true, count: 1 });
  assert.deepEqual(demo.current.fixedRoutines.at(-1).studentId, "gym-fixed-student-muslib-lite");
  demo.training = deleteGymTrainingGroup(demo.training, token("gym-fixed-teacher-linked"), "gym-dated-group-strength", NOW).state;
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutineForGroup("gym-dated-group-strength", "Group", "Plan"), { success: false, error: "Grupo no encontrado." });
});

test("group context is fetched exactly once per queued execution and trusted getter failures propagate", async () => {
  let reads = 0;
  const demo = setup({ getTrainingState: () => { reads += 1; return createGymTrainingDemoFixture(); } });
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutineForGroup("gym-dated-group-strength", "Group", "Plan"), { success: true, count: 2 });
  assert.equal(reads, 1);
  const failure = setup({ getTrainingState: () => { throw new Error("training failed"); } });
  await assert.rejects(failure.callbacks.onCreateFixedRoutineForGroup("gym-dated-group-strength", "Group", "Plan"), /training failed/);
});

test("allocation sees history, is bounded, and reservations survive reset", async () => {
  const ids = ["gym-fixed-deleted", "fresh", "fresh"];
  const demo = setup({ nextId: () => ids.shift() ?? "fresh" });
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "A", "B"), { success: true, id: "fresh" });
  demo.current = createGymFixedDemoFixture();
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "A", "B"), { success: false, error: "No se pudo generar un identificador de rutina único." });
  const stuck = setup({ nextId: () => "gym-fixed-active" });
  assert.deepEqual(await stuck.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "A", "B"), { success: false, error: "No se pudo generar un identificador de rutina único." });
});

test("same queued invocation coalesces and cancellation cannot clear new pending work", async () => {
  const demo = setup();
  const old = demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "Old", "Body");
  assert.equal(old, demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "Old", "Body"));
  demo.callbacks.cancelPending();
  const fresh = demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "New", "Body");
  assert.deepEqual(await old, { success: false, error: "La operación de rutinas fue cancelada." });
  assert.deepEqual(await fresh, { success: true, id: "gym-fixed-local-1" });
});

test("canonical actor denial happens before state, training context, IDs, clock, or caller hooks", async () => {
  let reads = 0;
  const hostile = Object.defineProperty({}, "id", { get() { reads += 1; throw new Error("actor"); } });
  const factory = createGymFixedCallbackFactory({ getState: () => { reads += 1; throw new Error("state"); }, getTrainingState: () => { reads += 1; throw new Error("training"); }, commit: () => { reads += 1; }, fixedActorToken: hostile, nextId: () => { reads += 1; return "x"; }, now: () => { reads += 1; return new Date(NOW); } });
  assert.deepEqual(await factory.onCreateFixedRoutineForGroup(hostile, hostile, hostile, hostile), { success: false, error: "No autorizado." });
  assert.equal(reads, 0);
  const uiCopy = getGymFixedDemoActor("gym-fixed-teacher-linked");
  const copied = createGymFixedCallbackFactory({ getState: () => createGymFixedDemoFixture(), getTrainingState: () => createGymTrainingDemoFixture(), commit: () => {}, fixedActorToken: uiCopy });
  assert.deepEqual(await copied.onDeleteFixedRoutine("gym-fixed-active"), { success: false, error: "No autorizado." });
});
