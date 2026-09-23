import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedDemoFixture } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymFixedDemoActor, getGymFixedDemoActorToken } from "./gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedCallbackFactory } from "./gym-fixed-demo-adapters.ts";

const NOW = "2025-05-10T14:30:00.000Z";

function token(id) {
  const value = getGymFixedDemoActorToken(id);
  assert.ok(value, `missing token ${id}`);
  return value;
}

function setup(overrides = {}) {
  let current = createGymFixedDemoFixture();
  const commits = [];
  const callbacks = createGymFixedCallbackFactory({
    getState: () => current,
    commit: (state) => { current = state; commits.push(state); },
    fixedActorToken: token("gym-fixed-teacher-linked"),
    now: () => new Date(NOW),
    ...overrides,
  });
  return { callbacks, commits, get current() { return current; }, set current(value) { current = value; } };
}

test("adapter exposes the five live callback signatures and preserves core create/update/renew/delete/group results", async () => {
  const demo = setup();
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "  Fuerza  ", "  Sentadilla  ", "2025-06-10"), {
    success: true,
    id: "gym-fixed-local-1",
  });
  assert.deepEqual(await demo.callbacks.onUpdateFixedRoutine("gym-fixed-local-1", " Editada ", " Body ", ""), { success: true });
  assert.deepEqual(await demo.callbacks.onUpdateFixedRoutineRenewAt("gym-fixed-local-1", new Date("2025-06-12T18:00:00.000Z")), { success: true });
  assert.deepEqual(await demo.callbacks.onDeleteFixedRoutine("gym-fixed-local-1"), { success: true });
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutineForGroup("gym-fixed-group-linked", " Grupo ", " Plan ", "2025-06-15"), {
    success: true,
    count: 2,
  });
  const grouped = demo.current.fixedRoutines.slice(-2);
  assert.deepEqual(grouped.map((routine) => routine.studentId), ["gym-fixed-student-muslib", "gym-fixed-student-muslib-lite"]);
  assert.ok(grouped.every((routine) => routine.assignedAt === NOW && routine.renewAt === "2025-06-15"));
  assert.equal(demo.commits.length, 5);
});

test("ID allocation sees soft-deleted history, retries bounded collisions, and keeps IDs reserved across state reset", async () => {
  const candidates = ["gym-fixed-deleted", "fresh-id", "fresh-id"];
  const demo = setup({ nextId: () => candidates.shift() ?? "fresh-id" });
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "A", "B"), { success: true, id: "fresh-id" });
  demo.current = createGymFixedDemoFixture();
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "A", "B"), {
    success: false,
    error: "No se pudo generar un identificador de rutina único.",
  });

  const stuck = setup({ nextId: () => "gym-fixed-active" });
  assert.deepEqual(await stuck.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "A", "B"), {
    success: false,
    error: "No se pudo generar un identificador de rutina único.",
  });
});

test("same in-flight invocation coalesces, different work returns busy, and settled replay creates a new assignment", async () => {
  const demo = setup();
  const first = demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "Uno", "Body");
  const same = demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "Uno", "Body");
  const different = demo.callbacks.onCreateFixedRoutine("gym-fixed-student-personalized", "Dos", "Body");
  assert.equal(first, same);
  assert.deepEqual(await different, { success: false, error: "Hay otra operación de rutinas en curso." });
  assert.deepEqual(await first, { success: true, id: "gym-fixed-local-1" });
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "Uno", "Body"), {
    success: true,
    id: "gym-fixed-local-2",
  });
});

test("cancelPending invalidates queued work without allowing old cleanup to erase fresh pending work", async () => {
  const demo = setup();
  const old = demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "Vieja", "Body");
  demo.callbacks.cancelPending();
  const fresh = demo.callbacks.onCreateFixedRoutine("gym-fixed-student-general", "Nueva", "Body");
  assert.deepEqual(await old, { success: false, error: "La operación de rutinas fue cancelada." });
  assert.deepEqual(await fresh, { success: true, id: "gym-fixed-local-1" });
  assert.equal(demo.commits.length, 1);
});

test("canonical actor references are required before state, ID, clock, or hostile input inspection", async () => {
  let dependencies = 0;
  const hostileState = Object.defineProperty({}, "fixedRoutines", { get() { dependencies += 1; throw new Error("state read"); } });
  const hostile = Object.defineProperty({}, "id", { enumerable: true, get() { dependencies += 1; throw new Error("actor read"); } });
  const forged = createGymFixedCallbackFactory({
    getState: () => { dependencies += 1; return hostileState; },
    commit: () => { dependencies += 1; },
    fixedActorToken: hostile,
    nextId: () => { dependencies += 1; return "never"; },
    now: () => { dependencies += 1; return new Date(NOW); },
  });
  const getterArgument = Object.defineProperty({}, "value", { enumerable: true, get() { dependencies += 1; throw new Error("input read"); } });
  assert.deepEqual(await forged.onCreateFixedRoutine(getterArgument, getterArgument, getterArgument, getterArgument), { success: false, error: "No autorizado." });
  assert.deepEqual(await forged.onCreateFixedRoutineForGroup(getterArgument, getterArgument, getterArgument, getterArgument), { success: false, error: "No autorizado." });
  assert.equal(dependencies, 0);

  const uiCopy = getGymFixedDemoActor("gym-fixed-teacher-linked");
  const copied = createGymFixedCallbackFactory({ getState: () => hostileState, commit: () => {}, fixedActorToken: uiCopy });
  assert.deepEqual(await copied.onDeleteFixedRoutine("gym-fixed-active"), { success: false, error: "No autorizado." });
  assert.equal(dependencies, 0);
});

test("authorized hostile arguments fail coherently without commits, while trusted dependency failures propagate", async () => {
  const demo = setup();
  const cycle = {}; cycle.self = cycle;
  assert.deepEqual(await demo.callbacks.onCreateFixedRoutine(cycle, BigInt(1), cycle, cycle), { success: false, error: "La rutina no es válida." });
  assert.equal(demo.commits.length, 0);
  assert.deepEqual(await demo.callbacks.onUpdateFixedRoutine("gym-fixed-active", "A", "B", cycle), { success: false, error: "La rutina no es válida." });
  assert.deepEqual(await demo.callbacks.onUpdateFixedRoutineRenewAt("gym-fixed-active", new Proxy(new Date(), {})), {
    success: false,
    error: "Fecha de renovación inválida.",
  });
  assert.equal(demo.commits.length, 0);

  const clockFailure = setup({ now: () => { throw new Error("clock failed"); } });
  await assert.rejects(clockFailure.callbacks.onDeleteFixedRoutine("gym-fixed-active"), /clock failed/);
  const stateFailure = createGymFixedCallbackFactory({
    getState: () => { throw new Error("state failed"); },
    commit: () => {},
    fixedActorToken: token("gym-fixed-teacher-linked"),
  });
  await assert.rejects(stateFailure.onDeleteFixedRoutine("gym-fixed-active"), /state failed/);
});
