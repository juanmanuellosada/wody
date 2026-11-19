import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedDemoFixture } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedRoutineForGroup, getGymFixedDemoGroupEligibility, projectGymFixedAssignmentContext } from "./gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { assignGymTrainingStudentToGroup, createGymTrainingGroup, deleteGymTrainingGroup, removeGymTrainingStudentFromGroup, renameGymTrainingGroup, resolveGymFixedGroupAssignment, resolveGymFixedGroupScope } from "./gym-training-demo-state.ts";

const groupId = "gym-dated-group-strength";
const token = (id) => { const value = getGymDemoActorToken(id); assert.ok(value); return value; };
const teacher = () => token("gym-fixed-teacher-linked");
const admin = () => token("gym-fixed-admin");
const other = () => token("gym-fixed-teacher-unlinked");
const now = () => new Date("2025-05-10T14:30:00.000Z");

test("scope is token-first and rejects unknown or revoked actor without state/group reads", () => {
  let reads = 0;
  const state = Object.defineProperty({}, "groups", { get() { reads += 1; throw new Error("state read"); } });
  const group = Object.defineProperty({}, "id", { get() { reads += 1; throw new Error("group read"); } });
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  for (const actor of [{ id: "gym-fixed-teacher-linked" }, revoked.proxy]) assert.deepEqual(resolveGymFixedGroupScope(state, actor, group), { success: false, error: "No autorizado." });
  assert.equal(reads, 0);
});

test("scope validates current namespace/state/group and current teacher/admin permissions", () => {
  const state = createGymTrainingDemoFixture();
  assert.deepEqual(resolveGymFixedGroupScope({ ...state, namespace: "wrong" }, teacher(), groupId), { success: false, error: "El estado de entrenamiento no es válido." });
  assert.deepEqual(resolveGymFixedGroupScope(state, teacher(), "missing"), { success: false, error: "Grupo no encontrado." });
  assert.deepEqual(resolveGymFixedGroupScope(state, other(), groupId), { success: false, error: "No autorizado para este grupo." });
  assert.deepEqual(resolveGymFixedGroupScope(state, admin(), groupId), { success: true, groupId, teacherId: "gym-fixed-teacher-linked", name: "Fuerza mañana" });
  const deleted = deleteGymTrainingGroup(state, teacher(), groupId, "2025-05-20T00:00:00.000Z").state;
  assert.deepEqual(resolveGymFixedGroupScope(deleted, teacher(), groupId), { success: false, error: "Grupo no encontrado." });
});

test("empty valid group has scope but fixed action retains title/content before eligibility", () => {
  const state = { ...createGymTrainingDemoFixture(), memberships: [] };
  assert.equal(resolveGymFixedGroupScope(state, teacher(), groupId).success, true);
  const fixed = createGymFixedDemoFixture();
  assert.deepEqual(createGymFixedRoutineForGroup(fixed, state, teacher(), { groupId, ids: [], title: "", content: "" }, now).result, { success: false, error: "El título es obligatorio." });
  assert.deepEqual(createGymFixedRoutineForGroup(fixed, state, teacher(), { groupId, ids: [], title: "x", content: "" }, now).result, { success: false, error: "El contenido es obligatorio." });
  assert.deepEqual(createGymFixedRoutineForGroup(fixed, state, teacher(), { groupId, ids: [], title: "x", content: "x" }, now).result, { success: false, error: "El grupo no tiene alumnos de musculación libre." });
});

test("scope metadata is detached and cannot grant permission after current group mutation", () => {
  const state = createGymTrainingDemoFixture();
  const scope = resolveGymFixedGroupScope(state, teacher(), groupId);
  assert.equal(scope.success, true);
  assert.throws(() => { scope.name = "Forged"; });
  const removed = deleteGymTrainingGroup(state, teacher(), groupId, "2025-05-20T00:00:00.000Z").state;
  assert.deepEqual(resolveGymFixedGroupScope(removed, teacher(), groupId), { success: false, error: "Grupo no encontrado." });
});

test("actual dated group commands immediately drive fixed eligibility, context, and batches without rewriting history", () => {
  let dated = createGymTrainingDemoFixture();
  dated = createGymTrainingGroup(dated, teacher(), "bridge-group", " Puente ").state;
  dated = renameGymTrainingGroup(dated, teacher(), "bridge-group", " Puente actual ").state;
  assert.deepEqual(resolveGymFixedGroupAssignment(dated, teacher(), "bridge-group"), { success: false, error: "El grupo no tiene alumnos de musculación libre." });
  dated = assignGymTrainingStudentToGroup(dated, teacher(), "gym-fixed-student-muslib", "bridge-group").state;
  assert.deepEqual(getGymFixedDemoGroupEligibility(dated, teacher(), "bridge-group"), { success: true, studentIds: ["gym-fixed-student-muslib"] });
  const fixedBefore = createGymFixedDemoFixture();
  const batched = createGymFixedRoutineForGroup(fixedBefore, dated, teacher(), { groupId: "bridge-group", ids: ["bridge-fixed"], title: "Bridge", content: "Body" }, now);
  assert.deepEqual(batched.result, { success: true, count: 1 });
  assert.equal(batched.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-history")?.title, "Base inicial");
  assert.ok(projectGymFixedAssignmentContext(batched.state, dated, teacher())?.groups.some((group) => group.id === "bridge-group"));
  dated = removeGymTrainingStudentFromGroup(dated, teacher(), "gym-fixed-student-muslib", "bridge-group").state;
  assert.deepEqual(getGymFixedDemoGroupEligibility(dated, teacher(), "bridge-group"), { success: false, error: "El grupo no tiene alumnos de musculación libre." });
  dated = deleteGymTrainingGroup(dated, teacher(), "bridge-group", "2025-05-20T00:00:00.000Z").state;
  assert.deepEqual(getGymFixedDemoGroupEligibility(dated, teacher(), "bridge-group"), { success: false, error: "Grupo no encontrado." });
  assert.equal(batched.state.fixedRoutines.some((routine) => routine.id === "bridge-fixed"), true);
});
