import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createPersonalTrainingDemoFixture } from "./personal-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getPersonalTrainingActorToken } from "./personal-training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createPersonalTrainingCallbackFactory } from "./personal-training-demo-adapters.ts";

const NOW = "2025-05-11T14:30:00.000Z";

function target() {
  return { type: "STUDENT", studentId: "personal-student-owner" };
}

function setup(overrides = {}) {
  let current = createPersonalTrainingDemoFixture();
  const commits = [];
  const callbacks = createPersonalTrainingCallbackFactory({
    getState: () => current,
    commit: (state) => { current = state; commits.push(state); },
    personalActorToken: getPersonalTrainingActorToken(),
    now: () => new Date(NOW),
    ...overrides,
  });
  return { callbacks, commits, get current() { return current; }, set current(value) { current = value; } };
}

test("locked WodManager callback signatures preserve create/update/copy/delete parity and soft-delete history", async () => {
  const demo = setup();
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-02-30", "  Fuerza  ", "  Sin recortar  ", target()), {
    success: true,
    wodId: "personal-wod-1",
  });
  assert.deepEqual(demo.current.wods.at(-1), {
    id: "personal-wod-1",
    title: "Fuerza",
    content: "  Sin recortar  ",
    date: "2025-03-02",
    teacherId: "personal-student-owner",
    targetType: "STUDENT",
    targetGroupId: null,
    targetStudentId: "personal-student-owner",
    deletedAt: null,
  });
  assert.deepEqual(await demo.callbacks.onUpdateWod("personal-wod-1", "", "  Editado  ", "", target()), { success: true });
  assert.deepEqual(await demo.callbacks.onCopyWod("personal-wod-1", "2025-05-12", target()), {
    success: true,
    wodId: "personal-wod-2",
  });
  assert.deepEqual(await demo.callbacks.onDeleteWod("personal-wod-1"), { success: true });
  const deleted = demo.current.wods.find((wod) => wod.id === "personal-wod-1");
  assert.equal(deleted.deletedAt, NOW);
  assert.equal(demo.current.wods.some((wod) => wod.id === "personal-wod-1"), true);
  assert.equal(demo.commits.length, 4);
});

test("locked target admits only exact self and rejects all retarget, group, foreign, and unknown-field inputs without mutation", async () => {
  const demo = setup();
  const invalidTargets = [
    { type: "ALL" },
    { type: "GROUP", groupId: "group" },
    { type: "MUSCULACION_LIBRE", studentId: "personal-student-owner" },
    { type: "STUDENT", studentId: "foreign-student" },
    { type: "STUDENT", studentId: "personal-student-owner", extra: true },
  ];
  for (const invalid of invalidTargets) {
    assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-12", "A", "B", invalid), { success: false, error: "La rutina no es válida." });
    assert.deepEqual(await demo.callbacks.onUpdateWod("personal-wod-current", "A", "B", "2025-05-12", invalid), { success: false, error: "La rutina no es válida." });
    assert.deepEqual(await demo.callbacks.onCopyWod("personal-wod-current", "2025-05-12", invalid), { success: false, error: "La rutina no es válida." });
  }
  assert.equal(demo.commits.length, 0);
});

test("canonical capability is checked before state, ID, clock, signatures, or hostile actor/argument getters", async () => {
  let dependencies = 0;
  const hostileActor = Object.defineProperty({}, "id", { enumerable: true, get() { dependencies += 1; throw new Error("actor read"); } });
  const hostileInput = Object.defineProperty({}, "value", { enumerable: true, get() { dependencies += 1; throw new Error("input read"); } });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const actor of [hostileActor, { id: "personal-student-owner", role: "STUDENT" }, new Proxy(getPersonalTrainingActorToken(), {}) , revoked.proxy]) {
    const callbacks = createPersonalTrainingCallbackFactory({
      getState: () => { dependencies += 1; throw new Error("state read"); },
      commit: () => { dependencies += 1; },
      personalActorToken: actor,
      nextId: () => { dependencies += 1; return "personal-wod-never"; },
      now: () => { dependencies += 1; return new Date(NOW); },
    });
    assert.deepEqual(await callbacks.onCreateWod(hostileInput, hostileInput, hostileInput, hostileInput), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.onUpdateWod(hostileInput, hostileInput, hostileInput, hostileInput, hostileInput), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.onDeleteWod(hostileInput), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.onCopyWod(hostileInput, hostileInput, hostileInput), { success: false, error: "No autorizado." });
  }
  assert.equal(dependencies, 0);
});

test("authorized malformed values have no coercion side effects, while trusted getState, commit, and clock failures propagate", async () => {
  const demo = setup();
  const cyclic = {}; cyclic.self = cyclic;
  const getterTarget = Object.defineProperty({}, "type", { enumerable: true, get() { throw new Error("must not read"); } });
  assert.deepEqual(await demo.callbacks.onCreateWod(cyclic, BigInt(1), cyclic, getterTarget), { success: false, error: "La rutina no es válida." });
  assert.deepEqual(await demo.callbacks.onUpdateWod("personal-wod-current", "A", "B", cyclic), { success: false, error: "La rutina no es válida." });
  assert.equal(demo.commits.length, 0);

  const stateFailure = createPersonalTrainingCallbackFactory({
    getState: () => { throw new Error("state failed"); },
    commit: () => {},
    personalActorToken: getPersonalTrainingActorToken(),
  });
  await assert.rejects(stateFailure.onDeleteWod("personal-wod-current"), /state failed/);
  const commitFailure = setup({ commit: () => { throw new Error("commit failed"); } });
  await assert.rejects(commitFailure.callbacks.onUpdateWod("personal-wod-current", "A", "B"), /commit failed/);
  const clockFailure = setup({ now: () => { throw new Error("clock failed"); } });
  await assert.rejects(clockFailure.callbacks.onDeleteWod("personal-wod-current"), /clock failed/);
});

test("ID allocation sees active and soft-deleted IDs, retries collisions, reserves failed allocations, and exhausts after bounded attempts", async () => {
  const candidates = ["personal-wod-deleted", "personal-wod-fresh", "personal-wod-failed", "personal-wod-failed", "personal-wod-fresh-2"];
  const demo = setup({ nextId: () => candidates.shift() ?? "personal-wod-fresh-2" });
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-12", "A", "B", target()), { success: true, wodId: "personal-wod-fresh" });
  // This allocation is retained even though the core rejects blank content.
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-12", "A", "  ", target()), { success: false, error: "El contenido de la Rutina no puede estar vacio." });
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-12", "A", "B", target()), { success: true, wodId: "personal-wod-fresh-2" });

  const exhausted = setup({ nextId: () => "personal-wod-current" });
  assert.deepEqual(await exhausted.callbacks.onCopyWod("personal-wod-current", "2025-05-12"), {
    success: false,
    error: "No se pudo generar un identificador de rutina único.",
  });
});

test("queued work uses fresh state, coalesces equal work, reports busy distinct work, and permits settled replay", async () => {
  const demo = setup();
  const first = demo.callbacks.onCreateWod("2025-05-12", "Uno", "Body", target());
  const same = demo.callbacks.onCreateWod("2025-05-12", "Uno", "Body", target());
  const different = demo.callbacks.onCreateWod("2025-05-12", "Dos", "Body", target());
  assert.equal(first, same);
  assert.deepEqual(await different, { success: false, error: "Hay otra operación de rutinas en curso." });
  assert.deepEqual(await first, { success: true, wodId: "personal-wod-1" });
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-12", "Uno", "Body", target()), { success: true, wodId: "personal-wod-2" });

  const fresh = setup();
  const queued = fresh.callbacks.onCreateWod("2025-05-12", "Fresh", "Body", target());
  fresh.current = {
    ...fresh.current,
    wods: [...fresh.current.wods, { ...fresh.current.wods[0], id: "personal-wod-1" }],
  };
  assert.deepEqual(await queued, { success: true, wodId: "personal-wod-2" });
});

test("cancelPending invalidates old queued work and old cleanup cannot erase a newer operation", async () => {
  const demo = setup();
  const old = demo.callbacks.onCreateWod("2025-05-12", "Vieja", "Body", target());
  demo.callbacks.cancelPending();
  const fresh = demo.callbacks.onCreateWod("2025-05-12", "Nueva", "Body", target());
  assert.deepEqual(await old, { success: false, error: "La operación de rutinas fue cancelada." });
  assert.deepEqual(await fresh, { success: true, wodId: "personal-wod-1" });
  assert.equal(demo.commits.length, 1);
});
