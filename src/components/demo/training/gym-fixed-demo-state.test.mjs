import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedDemoFixture, getGymFixedDemoRoster } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  createGymFixedRoutine, createGymFixedRoutineForGroup, deleteGymFixedRoutine,
  getGymFixedDemoActorToken, getGymFixedDemoGroupEligibility, isGymFixedDemoDate,
  isValidGymFixedDemoState, projectGymFixedAssignmentContext,
  projectGymFixedRenewals, projectGymFixedStudentRoutine, renewGymFixedRoutine,
  updateGymFixedRoutine,
} from "./gym-fixed-demo-state.ts";

const now = () => new Date("2025-05-10T14:30:00.000Z");
const training = () => createGymTrainingDemoFixture();
const token = (id) => { const value = getGymFixedDemoActorToken(id); assert.ok(value, `missing token ${id}`); return value; };
const admin = () => token("gym-fixed-admin");
const teacher = () => token("gym-fixed-teacher-linked");
const otherTeacher = () => token("gym-fixed-teacher-unlinked");
const groupId = "gym-dated-group-strength";
const command = (id, studentId, extra = {}) => ({ id, studentId, title: "  Fuerza A  ", content: "3 x 8", renewAt: "2025-06-10", ...extra });
function rejected(state, transition, error) { assert.deepEqual(transition.result, { success: false, error }); assert.equal(transition.state, state); }

test("individual creation accepts current canonical GENERAL, PERSONALIZED, and MUSLIB FULL students", () => {
  let state = createGymFixedDemoFixture();
  for (const [id, studentId] of [["general", "gym-fixed-student-general"], ["personal", "gym-fixed-student-personalized"], ["muslib", "gym-fixed-student-muslib"]]) {
    const result = createGymFixedRoutine(state, teacher(), command(id, studentId, { content: "  Body  " }), now);
    assert.deepEqual(result.result, { success: true, id }); state = result.state;
  }
  assert.deepEqual(state.fixedRoutines.at(-1), { id: "muslib", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked", title: "Fuerza A", content: "Body", assignedAt: "2025-05-10T14:30:00.000Z", renewAt: "2025-06-10", deletedAt: null });
  const liteState = createGymFixedDemoFixture();
  rejected(liteState, createGymFixedRoutine(liteState, teacher(), command("lite", "gym-fixed-student-muslib-lite"), now), "No se puede asignar rutina fija a un alumno lite.");
  const linkState = createGymFixedDemoFixture();
  rejected(linkState, createGymFixedRoutine(linkState, otherTeacher(), command("link", "gym-fixed-student-muslib"), now), "Alumno no asignado a vos.");
  assert.equal(createGymFixedRoutine(createGymFixedDemoFixture(), admin(), command("admin", "gym-fixed-student-muslib"), now).result.success, true);
});

test("canonical directory token rejects copied profiles and allows no LITE or archived actor token", () => {
  const state = createGymFixedDemoFixture();
  const copy = getGymFixedDemoRoster().find((actor) => actor.id === "gym-fixed-teacher-linked");
  rejected(state, createGymFixedRoutine(state, copy, command("copy", "gym-fixed-student-muslib"), now), "No autorizado.");
  assert.equal(getGymFixedDemoActorToken("gym-fixed-student-muslib-lite"), null);
  assert.equal(getGymFixedDemoActorToken("gym-fixed-student-muslib-archived"), null);
  const hostile = Object.defineProperty({}, "fixedRoutines", { get() { throw new Error("read"); } });
  assert.equal(createGymFixedRoutine(hostile, { id: "gym-fixed-admin" }, command("never", "gym-fixed-student-muslib"), now).result.error, "No autorizado.");
});

test("ownership, soft deletion, renewals, trimming and date normalization preserve action behavior", () => {
  const initial = createGymFixedDemoFixture();
  rejected(initial, updateGymFixedRoutine(initial, otherTeacher(), { routineId: "gym-fixed-active", title: "x", content: "x" }), "No autorizado.");
  const updated = updateGymFixedRoutine(initial, admin(), { routineId: "gym-fixed-active", title: "  Editada ", content: " Body ", renewAt: "2025-02-29" });
  assert.equal(updated.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").renewAt, "2025-03-01");
  const renewed = renewGymFixedRoutine(updated.state, admin(), { routineId: "gym-fixed-active", renewAt: "2025-02-30" });
  const deleted = deleteGymFixedRoutine(renewed.state, teacher(), { routineId: "gym-fixed-active" }, now);
  assert.equal(deleted.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").deletedAt, "2025-05-10T14:30:00.000Z");
  assert.equal(projectGymFixedStudentRoutine(deleted.state, token("gym-fixed-student-muslib")).id, "gym-fixed-history");
  assert.equal(isGymFixedDemoDate("0004-02-29"), true);
});

test("group batch uses supplied current state and includes active MUSLIB LITE recipients", () => {
  const state = createGymFixedDemoFixture();
  const result = createGymFixedRoutineForGroup(state, training(), teacher(), { groupId, ids: ["group-a", "group-b"], title: "Group", content: "Body" }, now);
  assert.deepEqual(result.result, { success: true, count: 2 });
  assert.deepEqual(result.state.fixedRoutines.slice(-2).map((routine) => routine.studentId), ["gym-fixed-student-muslib", "gym-fixed-student-muslib-lite"]);
  const removed = { ...training(), memberships: training().memberships.filter((member) => member.studentId !== "gym-fixed-student-muslib") };
  const next = createGymFixedRoutineForGroup(state, removed, teacher(), { groupId, ids: ["only-lite"], title: "Group", content: "Body" }, now);
  assert.deepEqual(next.result, { success: true, count: 1 });
});

test("group action preserves live scope then title/content then eligibility precedence", () => {
  const empty = { ...training(), memberships: [] };
  const state = createGymFixedDemoFixture();
  rejected(state, createGymFixedRoutineForGroup(state, empty, teacher(), { groupId, ids: [], title: "", content: "" }, now), "El título es obligatorio.");
  rejected(state, createGymFixedRoutineForGroup(state, empty, teacher(), { groupId, ids: [], title: "x", content: "" }, now), "El contenido es obligatorio.");
  rejected(state, createGymFixedRoutineForGroup(state, empty, teacher(), { groupId, ids: [], title: "x", content: "x" }, now), "El grupo no tiene alumnos de musculación libre.");
  rejected(state, createGymFixedRoutineForGroup(state, training(), otherTeacher(), { groupId, ids: [], title: "x", content: "x" }, now), "No autorizado para este grupo.");
});

test("current eligibility requires valid current context, not fixture groups or caller arrays", () => {
  assert.deepEqual(getGymFixedDemoGroupEligibility(training(), teacher(), groupId), { success: true, studentIds: ["gym-fixed-student-muslib", "gym-fixed-student-muslib-lite"] });
  assert.deepEqual(getGymFixedDemoGroupEligibility({ ...training(), namespace: "wrong" }, teacher(), groupId), { success: false, error: "El estado de entrenamiento no es válido." });
  assert.deepEqual(getGymFixedDemoGroupEligibility(training(), teacher(), "missing"), { success: false, error: "Grupo no encontrado." });
  assert.deepEqual(getGymFixedDemoGroupEligibility(training(), token("gym-fixed-student-muslib"), Object.defineProperty({}, "id", { get() { throw new Error("read"); } })), { success: false, error: "No autorizado." });
});

test("assignment context derives current owned groups and canonical roster without stale fixture authority", () => {
  const state = createGymFixedDemoFixture();
  const current = { ...training(), groups: [...training().groups, { id: "a-group", name: "Alfa", teacherId: "gym-fixed-teacher-linked", deletedAt: null }] };
  const context = projectGymFixedAssignmentContext(state, current, teacher());
  assert.deepEqual(context.groups.map((group) => group.id), ["a-group", groupId]);
  assert.deepEqual(context.muslibStudents.map((student) => student.id), ["gym-fixed-student-muslib-lite", "gym-fixed-student-muslib"]);
  assert.equal(projectGymFixedAssignmentContext(state, { ...current, namespace: "wrong" }, teacher()), null);
  assert.equal(projectGymFixedAssignmentContext(state, current, token("gym-fixed-student-muslib")), null);
});

test("closed state and renewal projection retain historical routines, Map ordering, and date failures", () => {
  const state = createGymFixedDemoFixture();
  assert.equal(isValidGymFixedDemoState(state), true);
  assert.equal(isValidGymFixedDemoState({ ...state, namespace: "demo-box-training" }), false);
  assert.deepEqual(projectGymFixedRenewals(state, admin(), "2025-05-25").map((routine) => routine.id), ["gym-fixed-active"]);
  const ordered = { version: 1, namespace: "demo-gym-fixed-routines/v1", fixedRoutines: [
    { id: "early", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked", title: "A", content: "A", assignedAt: "2025-05-01T00:00:00.000Z", renewAt: "2025-05-26", deletedAt: null },
    { id: "other", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-personalized", teacherId: "gym-fixed-teacher-unlinked", title: "B", content: "B", assignedAt: "2025-05-01T00:00:00.000Z", renewAt: "2025-05-27", deletedAt: null },
    { id: "latest", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked", title: "C", content: "C", assignedAt: "2025-05-02T00:00:00.000Z", renewAt: "2025-05-28", deletedAt: null },
  ] };
  assert.deepEqual(projectGymFixedRenewals(ordered, admin(), "2025-05-21").map((routine) => routine.id), ["latest", "other"]);
  rejected(state, renewGymFixedRoutine(state, teacher(), { routineId: "gym-fixed-active", renewAt: "not-a-date" }), "Fecha de renovación inválida.");
  const empty = { version: 1, namespace: "demo-gym-fixed-routines/v1", fixedRoutines: [] };
  assert.deepEqual(projectGymFixedRenewals(empty, admin(), "2025-05-25"), []);
});

test("assignment context and renewal projection accept an optional display-only nameOverrides map that never changes eligibility, order, or canonical-only fields", () => {
  const state = createGymFixedDemoFixture();
  const current = training();
  const baselineContext = projectGymFixedAssignmentContext(state, current, teacher());

  // Omitted, explicit undefined, an empty map, and a map matching canonical names must all be byte-identical to no override.
  assert.deepEqual(projectGymFixedAssignmentContext(state, current, teacher(), undefined), baselineContext);
  assert.deepEqual(projectGymFixedAssignmentContext(state, current, teacher(), new Map()), baselineContext);
  const canonicalContextOverrides = new Map([["gym-fixed-student-muslib-lite", "León Acosta"], ["gym-fixed-student-muslib", "Micaela Torres"]]);
  assert.deepEqual(projectGymFixedAssignmentContext(state, current, teacher(), canonicalContextOverrides), baselineContext);

  const editedContext = projectGymFixedAssignmentContext(state, current, teacher(), new Map([["gym-fixed-student-muslib", "Nombre Editado"]]));
  assert.ok(editedContext.muslibStudents.some((student) => student.id === "gym-fixed-student-muslib" && student.name === "Nombre Editado"));
  // Eligibility (which students are pickable, and their id order) and unrelated fields are untouched.
  assert.deepEqual(editedContext.muslibStudents.map((student) => student.id), baselineContext.muslibStudents.map((student) => student.id));
  assert.deepEqual(editedContext.muslibStudents.map((student) => student.accountKind), baselineContext.muslibStudents.map((student) => student.accountKind));
  assert.deepEqual(editedContext.groups, baselineContext.groups);

  const baselineRenewals = projectGymFixedRenewals(state, admin(), "2025-05-25");
  assert.deepEqual(projectGymFixedRenewals(state, admin(), "2025-05-25", undefined), baselineRenewals);
  assert.deepEqual(projectGymFixedRenewals(state, admin(), "2025-05-25", new Map()), baselineRenewals);
  assert.deepEqual(projectGymFixedRenewals(state, admin(), "2025-05-25", new Map([["gym-fixed-student-muslib", "Micaela Torres"]])), baselineRenewals);
  const editedRenewals = projectGymFixedRenewals(state, admin(), "2025-05-25", new Map([["gym-fixed-student-muslib", "Nombre Editado"]]));
  assert.equal(baselineRenewals[0].studentName, "Micaela Torres");
  assert.equal(editedRenewals[0].studentName, "Nombre Editado");
  // Canonical-only fields (id/studentId/renewAt/overdue) are byte-identical; only the name text differs.
  const canonicalRenewalFields = (routine) => ({ id: routine.id, studentId: routine.studentId, renewAt: routine.renewAt, overdue: routine.overdue });
  assert.deepEqual(editedRenewals.map(canonicalRenewalFields), baselineRenewals.map(canonicalRenewalFields));
});
