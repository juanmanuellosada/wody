import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingCallbackFactory } from "./gym-training-demo-adapters.ts";

const IDS = {
  admin: "gym-fixed-admin",
  teacher: "gym-fixed-teacher-linked",
  secondary: "gym-fixed-teacher-unlinked",
  student: "gym-fixed-student-personalized",
  unlinked: "gym-fixed-student-personalized-unlinked",
  muslib: "gym-fixed-student-muslib",
};
const NOW = "2025-05-20T10:00:00.000Z";

function token(id) {
  const value = getGymDemoActorToken(id);
  assert.ok(value, `missing token ${id}`);
  return value;
}

function setup(overrides = {}) {
  let current = createGymTrainingDemoFixture();
  const commits = [];
  const callbacks = createGymTrainingCallbackFactory({
    gymActorToken: token(IDS.teacher),
    getState: () => current,
    commit: (state) => { current = state; commits.push(state); },
    now: () => new Date(NOW),
    ...overrides,
  });
  return { callbacks, commits, get current() { return current; }, set current(state) { current = state; } };
}

test("canonical staff callbacks execute dated WOD CRUD/copy and group CRUD with core-normalized values", async () => {
  const demo = setup();
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-02-30", "  Nueva  ", "Contenido", { type: "STUDENT", studentId: IDS.muslib }), { success: true, wodId: "gym-training-wod-1" });
  assert.deepEqual(await demo.callbacks.onUpdateWod("gym-training-wod-1", "  ", "Editado", "", { type: "ALL" }), { success: true });
  assert.deepEqual(await demo.callbacks.onCopyWod("gym-training-wod-1", "2025-05-21"), { success: true, wodId: "gym-training-wod-2" });
  assert.deepEqual(await demo.callbacks.onDeleteWod("gym-training-wod-1"), { success: true });
  assert.deepEqual(await demo.callbacks.onCreateGroup("  Nuevo grupo  "), { success: true, groupId: "gym-training-group-1" });
  assert.deepEqual(await demo.callbacks.onRenameGroup("gym-training-group-1", " Renombrado "), { success: true });
  assert.deepEqual(await demo.callbacks.onAssignStudentToGroup(IDS.muslib, "gym-training-group-1"), { success: true });
  assert.deepEqual(await demo.callbacks.onRemoveStudentFromGroup(IDS.muslib, "gym-training-group-1"), { success: true });
  assert.deepEqual(await demo.callbacks.onDeleteGroup("gym-training-group-1"), { success: true });
  assert.equal(demo.current.groups.at(-1).deletedAt, NOW);
  assert.equal(demo.current.wods.find((wod) => wod.id === "gym-training-wod-1"), undefined);
  assert.equal(demo.commits.length, 9);
});

test("canonical token gating is before state, fields, generator, clock, reflection, and role claims", async () => {
  let reads = 0;
  const getter = Object.defineProperty({}, "value", { enumerable: true, get() { reads += 1; throw new Error("must not read"); } });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const actor of [{ id: IDS.teacher, role: "TEACHER" }, new Proxy(token(IDS.teacher), {}), revoked.proxy]) {
    const callbacks = createGymTrainingCallbackFactory({
      gymActorToken: actor,
      getState: () => { reads += 1; throw new Error("state"); },
      commit: () => { reads += 1; },
      getId: () => { reads += 1; return "never"; },
      now: () => { reads += 1; return new Date(NOW); },
    });
    assert.deepEqual(await callbacks.onCreateWod(getter, getter, getter, getter), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.onCreateGroup(getter), { success: false, error: "No autorizado." });
  }
  assert.equal(reads, 0);
});

test("students are denied, whereas ADMIN keeps action-specific group authority including unlinked personalized membership", async () => {
  const student = setup({ gymActorToken: token(IDS.student) });
  assert.deepEqual(await student.callbacks.onCreateWod("2025-05-20", "x", "body", { type: "ALL" }), { success: false, error: "No autorizado." });
  const admin = setup({ gymActorToken: token(IDS.admin) });
  assert.deepEqual(await admin.callbacks.onCreateGroup("Administrado"), { success: true, groupId: "gym-training-group-1" });
  assert.deepEqual(await admin.callbacks.onAssignStudentToGroup(IDS.unlinked, "gym-training-group-1"), { success: true });
  assert.equal(admin.current.memberships.some((member) => member.groupId === "gym-training-group-1" && member.studentId === IDS.unlinked), true);
});

test("source and group preflight preserve not-found precedence before hostile targets or arguments are inspected", async () => {
  const demo = setup();
  let reads = 0;
  const hostile = Object.defineProperty({}, "type", { enumerable: true, get() { reads += 1; throw new Error("target"); } });
  assert.deepEqual(await demo.callbacks.onCopyWod("missing", "2025-05-20", hostile), { success: false, error: "Rutina origen no encontrada." });
  assert.deepEqual(await demo.callbacks.onUpdateWod("missing", "x", "body", "2025-05-20", hostile), { success: false, error: "Rutina no encontrada." });
  assert.deepEqual(await demo.callbacks.onAssignStudentToGroup(hostile, "missing-group"), { success: false, error: "Grupo no encontrado." });
  assert.equal(reads, 0);
  assert.deepEqual(await demo.callbacks.onCreateWod("not-a-date", "x", "  ", hostile), { success: false, error: "El contenido de la Rutina no puede estar vacio." });
  assert.deepEqual(await demo.callbacks.onCreateWod("not-a-date", "x", "body", hostile), { success: false, error: "Destinatario no válido." });
});

test("fresh execution state detects missing/foreign queued records and preserves invalid-state and trusted dependency failures", async () => {
  const demo = setup();
  const queued = demo.callbacks.onDeleteWod("gym-dated-all");
  demo.current = { ...demo.current, wods: demo.current.wods.filter((wod) => wod.id !== "gym-dated-all") };
  assert.deepEqual(await queued, { success: false, error: "Rutina no encontrada." });
  const invalid = setup();
  invalid.current = { ...invalid.current, kind: "BOX" };
  assert.deepEqual(await invalid.callbacks.onCreateGroup("x"), { success: false, error: "El estado de entrenamiento no es válido." });
  const stateFailure = createGymTrainingCallbackFactory({ gymActorToken: token(IDS.teacher), getState: () => { throw new Error("state failed"); }, commit: () => {} });
  assert.throws(() => stateFailure.onDeleteWod("gym-dated-all"), /state failed/);
  const commitFailure = setup({ commit: () => { throw new Error("commit failed"); } });
  await assert.rejects(commitFailure.callbacks.onCreateGroup("x"), /commit failed/);
  const clockFailure = setup({ now: () => { throw new Error("clock failed"); } });
  await assert.rejects(clockFailure.callbacks.onDeleteGroup("gym-dated-group-strength"), /clock failed/);
});

test("ID allocation sees all current records, retries bounded collisions, and reserves issued IDs through failures and reset", async () => {
  const candidates = ["gym-dated-all", "local-id", "failed-id", "failed-id", "after-failure"];
  const demo = setup({ getId: () => candidates.shift() ?? "after-failure" });
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-20", "A", "B", { type: "ALL" }), { success: true, wodId: "local-id" });
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-20", "A", "  ", { type: "ALL" }), { success: false, error: "El contenido de la Rutina no puede estar vacio." });
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-20", "A", "B", { type: "ALL" }), { success: true, wodId: "after-failure" });
  demo.current = createGymTrainingDemoFixture();
  assert.deepEqual(await demo.callbacks.onCreateWod("2025-05-20", "A", "B", { type: "ALL" }), { success: false, error: "No se pudo generar un identificador de rutina único." });
  let attempts = 0;
  const exhausted = setup({ getId: () => { attempts += 1; return "gym-dated-all"; } });
  assert.deepEqual(await exhausted.callbacks.onCreateGroup("x"), { success: false, error: "No se pudo generar un identificador de grupo único." });
  assert.equal(attempts, 64, "the bound applies to retry attempts, not identifier length");
});

test("a pending operation gates every distinct callback before state, record, group, ID, or clock preflight", async () => {
  let reads = 0;
  const demo = setup({
    getState: () => { reads += 1; return demo.current; },
    getId: () => { reads += 1; return "unexpected-id"; },
    now: () => { reads += 1; return new Date(NOW); },
  });
  const pending = demo.callbacks.onCreateGroup("Pending");
  const beforeBusy = reads;
  const invalid = Object.defineProperty({}, "value", { enumerable: true, get() { throw new Error("must not read"); } });
  const calls = [
    demo.callbacks.onCreateWod(invalid, invalid, invalid, invalid),
    demo.callbacks.onUpdateWod("missing", invalid, invalid, invalid, invalid),
    demo.callbacks.onDeleteWod("missing"),
    demo.callbacks.onCopyWod("missing", invalid, invalid),
    demo.callbacks.onCreateGroup("other"),
    demo.callbacks.onRenameGroup("missing", invalid),
    demo.callbacks.onDeleteGroup("missing"),
    demo.callbacks.onAssignStudentToGroup(invalid, "missing"),
    demo.callbacks.onRemoveStudentFromGroup(invalid, "missing"),
  ];
  assert.equal(reads, beforeBusy, "busy rejection is prior to all business dependencies");
  for (const call of calls) assert.deepEqual(await call, { success: false, error: "Hay otra operación de rutinas en curso." });
  assert.deepEqual(await pending, { success: true, groupId: "unexpected-id" });
  assert.deepEqual(await demo.callbacks.onDeleteWod("missing"), { success: false, error: "Rutina no encontrada." });
});

test("all operations share one pending slot: equal work coalesces, distinct work is busy, settled work repeats, and cancellation cannot clear newer work", async () => {
  const demo = setup();
  const first = demo.callbacks.onCreateGroup("Uno");
  const same = demo.callbacks.onCreateGroup("Uno");
  const different = demo.callbacks.onCreateWod("2025-05-20", "A", "B", { type: "ALL" });
  assert.equal(first, same);
  assert.deepEqual(await different, { success: false, error: "Hay otra operación de rutinas en curso." });
  assert.deepEqual(await first, { success: true, groupId: "gym-training-group-1" });
  assert.deepEqual(await demo.callbacks.onCreateGroup("Uno dos"), { success: true, groupId: "gym-training-group-2" });
  const old = demo.callbacks.onCreateWod("2025-05-20", "Vieja", "B", { type: "ALL" });
  demo.callbacks.cancelPending();
  const fresh = demo.callbacks.onCreateWod("2025-05-20", "Nueva", "B", { type: "ALL" });
  assert.deepEqual(await old, { success: false, error: "La operación de rutinas fue cancelada." });
  assert.deepEqual(await fresh, { success: true, wodId: "gym-training-wod-1" });
});
