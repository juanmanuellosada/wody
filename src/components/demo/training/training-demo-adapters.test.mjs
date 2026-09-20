import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingCallbackFactory } from "./training-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingDemoFixture } from "./training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { selectTrainingDemoActor } from "./training-demo-state.ts";

test("callback factory preserves stable WOD and group callback arguments and results", async () => {
  let current = selectTrainingDemoActor(createTrainingDemoFixture(), "t1").state;
  const committed = [];
  const callbacks = createTrainingCallbackFactory({
    getState: () => current,
    commit: (next) => { current = next; committed.push(next); },
    now: () => new Date("2025-05-01T10:00:00.000Z"),
  });

  assert.deepEqual(await callbacks.onCreateWod("2025-05-01", "Nuevo", "Contenido", { type: "STUDENT", studentId: "s1" }), {
    success: true,
    wodId: "wod-local-1",
  });
  assert.deepEqual(await callbacks.onUpdateWod("wod-local-1", "Editado", "Contenido dos", "2025-05-02", { type: "ALL" }), { success: true });
  assert.deepEqual(await callbacks.onCopyWod("wod-local-1", "2025-05-03", { type: "GROUP", groupId: "g1" }), {
    success: true,
    wodId: "wod-local-2",
  });
  assert.deepEqual(await callbacks.onDeleteWod("wod-local-1"), { success: true });
  assert.equal(current.wods.some((wod) => wod.id === "wod-local-2"), true);

  assert.deepEqual(await callbacks.onCreateGroup("Nuevo grupo"), { success: true, groupId: "group-local-1" });
  assert.deepEqual(await callbacks.onRenameGroup("group-local-1", "Grupo final"), { success: true });
  assert.deepEqual(await callbacks.onAssignStudentToGroup("s1", "group-local-1"), { success: true });
  assert.deepEqual(await callbacks.onRemoveStudentFromGroup("s1", "group-local-1"), { success: true });
  assert.deepEqual(await callbacks.onDeleteGroup("group-local-1"), { success: true });
  assert.equal(current.groups.find((group) => group.id === "group-local-1")?.deletedAt, "2025-05-01T10:00:00.000Z");
  assert.equal(committed.length, 9);
});

test("sequential and rapid callbacks always read current state instead of stale captured state", async () => {
  let current = selectTrainingDemoActor(createTrainingDemoFixture(), "t1").state;
  let commits = 0;
  const callbacks = createTrainingCallbackFactory({ getState: () => current, commit: (next) => { current = next; commits += 1; } });

  const [first, second] = await Promise.all([
    callbacks.onCreateWod("2025-05-01", "Uno", "Contenido", { type: "ALL" }),
    callbacks.onCreateWod("2025-05-02", "Dos", "Contenido", { type: "ALL" }),
  ]);
  assert.deepEqual([first.wodId, second.wodId], ["wod-local-1", "wod-local-2"]);
  assert.equal(current.wods.filter((wod) => wod.id.startsWith("wod-local-")).length, 2);
  const unchanged = current;
  assert.deepEqual(await callbacks.onCreateWod("2025-05-03", "Inválido", "Contenido", { type: "NOT_A_TARGET" }), {
    success: false,
    error: "Destinatario no válido.",
  });
  assert.equal(current, unchanged);
  assert.equal(commits, 2);

  const fixedStudent = await callbacks.onCreateFixedRoutine("s1", "No", "No", "2025-05-01");
  const fixedGroup = await callbacks.onCreateFixedRoutineForGroup("g1", "No", "No", "2025-05-01");
  assert.deepEqual(fixedStudent, { success: false, error: "Las rutinas de musculación no están disponibles en el demo BOX." });
  assert.deepEqual(fixedGroup, { success: false, error: "Las rutinas de musculación no están disponibles en el demo BOX." });
});
