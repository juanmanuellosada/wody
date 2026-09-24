import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  assignGymTrainingStudentToGroup,
  copyGymTrainingWod,
  createGymTrainingGroup,
  createGymTrainingWod,
  deleteGymTrainingGroup,
  deleteGymTrainingWod,
  isValidGymTrainingDemoState,
  projectGymTrainingViews,
  removeGymTrainingStudentFromGroup,
  renameGymTrainingGroup,
  resetGymTrainingDemoState,
  resolveGymFixedGroupAssignment,
  updateGymTrainingWod,
} from "./gym-training-demo-state.ts";

const ids = {
  admin: "gym-fixed-admin",
  primary: "gym-fixed-teacher-linked",
  secondary: "gym-fixed-teacher-unlinked",
  general: "gym-fixed-student-general",
  personalized: "gym-fixed-student-personalized",
  unlinkedPersonalized: "gym-fixed-student-personalized-unlinked",
  muslib: "gym-fixed-student-muslib",
};

function token(id) {
  const value = getGymDemoActorToken(id);
  assert.ok(value, `missing canonical token ${id}`);
  return value;
}

function rejected(state, result, error) {
  assert.equal(result.result.success, false);
  if (error) assert.equal(result.result.error, error);
  assert.equal(result.state, state);
}

test("GYM dated WOD CRUD, physical deletion, copy, normalized overflow dates, and empty update dates mirror the action shape", () => {
  let state = createGymTrainingDemoFixture();
  const created = createGymTrainingWod(state, token(ids.primary), "gym-wod-local", "0004-02-30", "  Nueva  ", "Contenido", { type: "STUDENT", studentId: ids.muslib });
  assert.deepEqual(created.result, { success: true, wodId: "gym-wod-local" });
  assert.equal(created.state.wods.at(-1).date, "0004-03-01");
  assert.equal(created.state.wods.at(-1).title, "Nueva");
  state = created.state;

  const edited = updateGymTrainingWod(state, token(ids.primary), "gym-wod-local", "  ", "Otro contenido", "", { type: "ALL" });
  assert.deepEqual(edited.result, { success: true });
  assert.deepEqual(edited.state.wods.at(-1), {
    id: "gym-wod-local", title: "Rutina", content: "Otro contenido", date: "0004-03-01", teacherId: ids.primary,
    targetType: "ALL", targetGroupId: null, targetStudentId: null,
  });
  const copied = copyGymTrainingWod(edited.state, token(ids.primary), "gym-wod-copy", "gym-wod-local", "2025-02-30");
  assert.deepEqual(copied.result, { success: true, wodId: "gym-wod-copy" });
  assert.equal(copied.state.wods.at(-1).date, "2025-03-02");
  const deleted = deleteGymTrainingWod(copied.state, token(ids.primary), "gym-wod-local");
  assert.deepEqual(deleted.result, { success: true });
  assert.equal(deleted.state.wods.some((wod) => wod.id === "gym-wod-local"), false);
  assert.equal(deleted.state.wods.some((wod) => wod.id === "gym-wod-copy"), true);
});

test("GYM target ownership keeps direct FULL MUSLIB legal, rejects LITE/direct foreign and UI-only targets, and does not grant an admin a universal WOD bypass", () => {
  const state = createGymTrainingDemoFixture();
  assert.equal(createGymTrainingWod(state, token(ids.primary), "gym-muslib", "2025-05-20", "x", "body", { type: "STUDENT", studentId: ids.muslib }).result.success, true);
  for (const [actor, id, target, error] of [
    [ids.primary, "gym-lite", { type: "STUDENT", studentId: "gym-fixed-student-muslib-lite" }, "No se pueden asignar rutinas a un alumno lite."],
    [ids.primary, "gym-unlinked", { type: "STUDENT", studentId: ids.unlinkedPersonalized }, "Alumno no asignado a vos."],
    [ids.admin, "gym-admin-direct", { type: "STUDENT", studentId: ids.personalized }, "Alumno no asignado a vos."],
    [ids.primary, "gym-ui-student", { type: "MUSCULACION_LIBRE", studentId: ids.muslib }, "Destinatario no válido."],
    [ids.primary, "gym-ui-group", { type: "MUSCULACION_LIBRE_GROUP", groupId: "gym-dated-group-strength" }, "Destinatario no válido."],
    [ids.secondary, "gym-foreign-group", { type: "GROUP", groupId: "gym-dated-group-strength" }, "Grupo no encontrado."],
  ]) rejected(state, createGymTrainingWod(state, token(actor), id, "2025-05-20", "x", "body", target), error);
  rejected(state, updateGymTrainingWod(state, token(ids.secondary), "gym-dated-all", "x", "body"), "Rutina no encontrada.");
  rejected(state, copyGymTrainingWod(state, token(ids.secondary), "gym-copy", "gym-dated-all", "2025-05-20"), "Rutina origen no encontrada.");
});

test("GYM group CRUD applies action-specific admin ownership, idempotent assignment, personalized link rules, and muslib link asymmetry", () => {
  let state = createGymTrainingDemoFixture();
  const created = createGymTrainingGroup(state, token(ids.primary), "gym-group-new", "  Turno nuevo  ");
  assert.deepEqual(created.result, { success: true, groupId: "gym-group-new" });
  state = created.state;
  rejected(state, createGymTrainingGroup(state, token(ids.primary), "gym-group-other", "Turno nuevo"), "Ya tenés un grupo con ese nombre.");
  rejected(state, assignGymTrainingStudentToGroup(state, token(ids.primary), ids.general, "gym-group-new"), "Solo alumnos personalizados o de musculación libre pueden pertenecer a un grupo.");
  rejected(state, assignGymTrainingStudentToGroup(state, token(ids.primary), ids.unlinkedPersonalized, "gym-group-new"), "Este alumno no está asignado a vos.");
  const muslib = assignGymTrainingStudentToGroup(state, token(ids.primary), ids.muslib, "gym-group-new");
  assert.deepEqual(muslib.result, { success: true });
  const idempotent = assignGymTrainingStudentToGroup(muslib.state, token(ids.primary), ids.muslib, "gym-group-new");
  assert.deepEqual(idempotent.result, { success: true });
  assert.equal(idempotent.state, muslib.state, "upsert parity preserves the already-current ledger");
  const adminAdd = assignGymTrainingStudentToGroup(idempotent.state, token(ids.admin), ids.unlinkedPersonalized, "gym-group-new");
  assert.equal(adminAdd.result.success, true);
  const renamed = renameGymTrainingGroup(adminAdd.state, token(ids.admin), "gym-group-new", "Administrado");
  assert.equal(renamed.result.success, true);
  const removed = removeGymTrainingStudentFromGroup(renamed.state, token(ids.primary), ids.muslib, "gym-group-new");
  assert.equal(removed.result.success, true);
  const absent = removeGymTrainingStudentFromGroup(removed.state, token(ids.primary), ids.muslib, "gym-group-new");
  assert.deepEqual(absent.result, { success: true });
  assert.equal(absent.state, removed.state);
});

test("GYM group deletion atomically soft-deletes the group, removes memberships, and retains a detached GROUP WOD relation", () => {
  const state = createGymTrainingDemoFixture();
  const deleted = deleteGymTrainingGroup(state, token(ids.primary), "gym-dated-group-strength", "2025-05-20T10:00:00.000Z");
  assert.deepEqual(deleted.result, { success: true });
  assert.equal(deleted.state.groups[0].deletedAt, "2025-05-20T10:00:00.000Z");
  assert.equal(deleted.state.memberships.some((membership) => membership.groupId === "gym-dated-group-strength"), false);
  assert.deepEqual(deleted.state.wods.find((wod) => wod.id === "gym-dated-group"), {
    id: "gym-dated-group", title: "Bloque de fuerza", content: "Trabajo por estaciones.", date: "2025-05-03", teacherId: ids.primary,
    targetType: "GROUP", targetGroupId: null, targetStudentId: null,
  });
  assert.equal(isValidGymTrainingDemoState(deleted.state), true);
  rejected(state, deleteGymTrainingGroup(state, token(ids.secondary), "gym-dated-group-strength", "2025-05-20T10:00:00.000Z"), "Grupo no encontrado.");
});

test("GYM projections use canonical links and current memberships, while MUSLIB routes away from dated WODs", () => {
  const state = createGymTrainingDemoFixture();
  const personalized = projectGymTrainingViews(state, token(ids.personalized));
  assert.equal(personalized.success, true);
  assert.deepEqual(personalized.student.wods.map((wod) => wod.id), ["gym-dated-direct", "gym-dated-group", "gym-dated-personalized", "gym-dated-all"]);
  const general = projectGymTrainingViews(state, token(ids.general));
  assert.equal(general.success, true);
  assert.deepEqual(general.student.wods.map((wod) => wod.id), ["gym-dated-all"]);
  const muslib = projectGymTrainingViews(state, token(ids.muslib));
  assert.equal(muslib.success, true);
  assert.deepEqual(muslib.student.wods, []);
  const removed = removeGymTrainingStudentFromGroup(state, token(ids.primary), ids.personalized, "gym-dated-group-strength");
  const after = projectGymTrainingViews(removed.state, token(ids.personalized));
  assert.equal(after.success, true);
  assert.equal(after.student.wods.some((wod) => wod.id === "gym-dated-group"), false);
  const staff = projectGymTrainingViews(state, token(ids.primary));
  assert.equal(staff.success, true);
  assert.deepEqual(staff.staff.wods.map((wod) => wod.id), ["gym-dated-direct", "gym-dated-group", "gym-dated-personalized", "gym-dated-all"]);
  assert.deepEqual(staff.staff.groups.map((group) => group.id), ["gym-dated-group-strength"]);
  assert.ok(Object.isFrozen(staff) && Object.isFrozen(staff.staff.wods));
});

test("GYM projections sort detached WODs by date descending and staff groups by name without inventing a tie order", () => {
  const fixture = createGymTrainingDemoFixture();
  const state = {
    ...fixture,
    groups: [
      ...fixture.groups,
      { id: "gym-dated-group-alpha", name: "Alfa", teacherId: ids.primary, deletedAt: null },
    ],
    wods: [
      ...fixture.wods,
      { id: "gym-dated-latest-first", title: "Última A", content: "A", date: "2025-05-10", teacherId: ids.primary, targetType: "ALL", targetGroupId: null, targetStudentId: null },
      { id: "gym-dated-latest-second", title: "Última B", content: "B", date: "2025-05-10", teacherId: ids.primary, targetType: "ALL", targetGroupId: null, targetStudentId: null },
    ],
  };
  const originalWods = state.wods.map((wod) => wod.id);
  const originalGroups = state.groups.map((group) => group.id);
  const staff = projectGymTrainingViews(state, token(ids.primary));
  const student = projectGymTrainingViews(state, token(ids.personalized));
  assert.equal(staff.success, true);
  assert.equal(student.success, true);
  assert.deepEqual(staff.staff.wods.map((wod) => wod.id), ["gym-dated-latest-first", "gym-dated-latest-second", "gym-dated-direct", "gym-dated-group", "gym-dated-personalized", "gym-dated-all"]);
  assert.deepEqual(student.student.wods.map((wod) => wod.id), ["gym-dated-latest-first", "gym-dated-latest-second", "gym-dated-direct", "gym-dated-group", "gym-dated-personalized", "gym-dated-all"]);
  assert.deepEqual(staff.staff.groups.map((group) => group.id), ["gym-dated-group-alpha", "gym-dated-group-strength"]);
  assert.deepEqual(state.wods.map((wod) => wod.id), originalWods);
  assert.deepEqual(state.groups.map((group) => group.id), originalGroups);
});

test("GYM staff projection preserves persisted admin-assigned members separately from the current eligible picker", () => {
  const fixture = createGymTrainingDemoFixture();
  const created = createGymTrainingGroup(fixture, token(ids.admin), "gym-admin-group", "Administración");
  assert.equal(created.result.success, true);
  const assigned = assignGymTrainingStudentToGroup(created.state, token(ids.admin), ids.unlinkedPersonalized, "gym-admin-group");
  assert.equal(assigned.result.success, true);
  const duplicate = assignGymTrainingStudentToGroup(assigned.state, token(ids.admin), ids.unlinkedPersonalized, "gym-admin-group");
  assert.equal(duplicate.state, assigned.state, "idempotent upsert retains the current state identity");
  const projected = projectGymTrainingViews(assigned.state, token(ids.admin));
  assert.equal(projected.success, true);
  const group = projected.staff.groups.find((candidate) => candidate.id === "gym-admin-group");
  assert.deepEqual(group?.students, [{ id: ids.unlinkedPersonalized, name: "Valeria Paz" }]);
  assert.equal(group?.availableToAdd.some((candidate) => candidate.id === ids.unlinkedPersonalized), false);
  assert.ok(group?.availableToAdd.some((candidate) => candidate.id === ids.muslib), "ADMIN's current muslib picker remains independent from persisted members");
});

test("GYM projections accept an optional display-only nameOverrides map that never changes eligibility or canonical-only fields", () => {
  const state = createGymTrainingDemoFixture();
  const actor = token(ids.primary);
  const baseline = projectGymTrainingViews(state, actor);

  // Omitted, explicit undefined, an empty map, and a map matching canonical names must all be byte-identical to no override.
  assert.deepEqual(projectGymTrainingViews(state, actor, undefined), baseline);
  assert.deepEqual(projectGymTrainingViews(state, actor, new Map()), baseline);
  const canonicalOverrides = new Map([[ids.personalized, "Irene Soto"], [ids.muslib, "Micaela Torres"]]);
  assert.deepEqual(projectGymTrainingViews(state, actor, canonicalOverrides), baseline);

  const edited = projectGymTrainingViews(state, actor, new Map([[ids.personalized, "Nombre Editado"]]));
  assert.equal(edited.success, true);
  const baselineGroup = baseline.staff.groups.find((candidate) => candidate.id === "gym-dated-group-strength");
  const editedGroup = edited.staff.groups.find((candidate) => candidate.id === "gym-dated-group-strength");
  // Display text follows the override: group roster and the WOD's direct-target name both change.
  assert.deepEqual(editedGroup.students, [
    { id: ids.personalized, name: "Nombre Editado" },
    { id: ids.muslib, name: "Micaela Torres" },
    { id: "gym-fixed-student-muslib-lite", name: "León Acosta" },
  ]);
  assert.deepEqual(baseline.staff.students, [{ id: ids.personalized, name: "Irene Soto" }]);
  assert.deepEqual(edited.staff.students, [{ id: ids.personalized, name: "Nombre Editado" }]);
  assert.equal(edited.staff.wods.find((wod) => wod.id === "gym-dated-direct")?.targetStudentName, "Nombre Editado");
  // Eligibility (who is a member, who is still pickable) is untouched: identical id sets/order to the baseline.
  assert.deepEqual(editedGroup.availableToAdd.map((candidate) => candidate.id), baselineGroup.availableToAdd.map((candidate) => candidate.id));
  assert.deepEqual(edited.staff.groups.map((group) => group.id), baseline.staff.groups.map((group) => group.id));
  // Canonical-only fields (wod id/teacherId/targetType/date/content, group id) are byte-identical; only the name text differs.
  const canonicalWodFields = (wod) => ({ id: wod.id, title: wod.title, content: wod.content, date: wod.date, teacherId: wod.teacherId, targetType: wod.targetType, targetGroupName: wod.targetGroupName });
  assert.deepEqual(edited.staff.wods.map(canonicalWodFields), baseline.staff.wods.map(canonicalWodFields));
  assert.deepEqual(edited.student, baseline.student);

  // A blank or whitespace-only override is not a display name: it falls back to the canonical name.
  const blank = projectGymTrainingViews(state, actor, new Map([[ids.personalized, "   "]]));
  assert.deepEqual(blank, baseline);
});

test("GYM WOD errors use gymTerms wording and production content-target-date precedence without mutation", () => {
  const state = createGymTrainingDemoFixture();
  const before = structuredClone(state);
  const invalidDate = "not-a-date";
  const missingDirect = { type: "STUDENT", studentId: "missing-student" };
  const foreignGroup = { type: "GROUP", groupId: "gym-dated-group-mobility" };
  const invalidTarget = { type: "UNKNOWN" };
  const contentError = "El contenido de la Rutina no puede estar vacio.";

  for (const result of [
    createGymTrainingWod(state, token(ids.primary), "precedence-create-content", invalidDate, "x", "  ", missingDirect),
    createGymTrainingWod(state, token(ids.primary), "precedence-create-target", invalidDate, "x", "body", missingDirect),
    createGymTrainingWod(state, token(ids.primary), "precedence-create-group", invalidDate, "x", "body", foreignGroup),
    createGymTrainingWod(state, token(ids.primary), "precedence-create-invalid-target", invalidDate, "x", "body", invalidTarget),
  ]) rejected(state, result);
  assert.deepEqual(createGymTrainingWod(state, token(ids.primary), "precedence-create-content", invalidDate, "x", "  ", missingDirect).result, { success: false, error: contentError });
  assert.deepEqual(createGymTrainingWod(state, token(ids.primary), "precedence-create-target", invalidDate, "x", "body", missingDirect).result, { success: false, error: "Alumno no asignado a vos." });
  assert.deepEqual(createGymTrainingWod(state, token(ids.primary), "precedence-create-group", invalidDate, "x", "body", foreignGroup).result, { success: false, error: "Grupo no encontrado." });
  assert.deepEqual(createGymTrainingWod(state, token(ids.primary), "precedence-create-invalid-target", invalidDate, "x", "body", invalidTarget).result, { success: false, error: "Destinatario no válido." });

  assert.deepEqual(updateGymTrainingWod(state, token(ids.primary), "gym-dated-all", "x", "  ", invalidDate, missingDirect).result, { success: false, error: contentError });
  assert.deepEqual(updateGymTrainingWod(state, token(ids.primary), "gym-dated-all", "x", "body", invalidDate, missingDirect).result, { success: false, error: "Alumno no asignado a vos." });
  assert.deepEqual(updateGymTrainingWod(state, token(ids.primary), "gym-dated-all", "x", "body", invalidDate, foreignGroup).result, { success: false, error: "Grupo no encontrado." });
  assert.deepEqual(updateGymTrainingWod(state, token(ids.primary), "gym-dated-all", "x", "body", invalidDate, { type: "ALL" }).result, { success: false, error: "La fecha no es válida." });

  assert.deepEqual(copyGymTrainingWod(state, token(ids.primary), "precedence-copy-missing", "missing-source", invalidDate, missingDirect).result, { success: false, error: "Rutina origen no encontrada." });
  assert.deepEqual(copyGymTrainingWod(state, token(ids.primary), "precedence-copy-target", "gym-dated-all", invalidDate, missingDirect).result, { success: false, error: "Alumno no asignado a vos." });
  assert.deepEqual(copyGymTrainingWod(state, token(ids.primary), "precedence-copy-group", "gym-dated-all", invalidDate, foreignGroup).result, { success: false, error: "Grupo no encontrado." });
  assert.deepEqual(copyGymTrainingWod(state, token(ids.primary), "precedence-copy-date", "gym-dated-all", invalidDate, { type: "ALL" }).result, { success: false, error: "La fecha no es válida." });
  assert.deepEqual(state, before, "every rejected command preserves the ledger contents");
});

test("fresh fixed-group resolver is token-first, current-state based, and produces detached immutable membership-order snapshots", () => {
  let reads = 0;
  const hostileState = Object.defineProperty({}, "groups", { enumerable: true, get() { reads += 1; throw new Error("must not read"); } });
  const forged = { id: ids.primary, role: "TEACHER" };
  assert.deepEqual(resolveGymFixedGroupAssignment(hostileState, forged, Object.defineProperty({}, "id", { get() { reads += 1; throw new Error("must not read"); } })), { success: false, error: "No autorizado." });
  assert.equal(reads, 0);

  const state = createGymTrainingDemoFixture();
  const resolved = resolveGymFixedGroupAssignment(state, token(ids.primary), "gym-dated-group-strength");
  assert.deepEqual(resolved, { success: true, groupId: "gym-dated-group-strength", teacherId: ids.primary, eligibleStudentIds: [ids.muslib, "gym-fixed-student-muslib-lite"] });
  assert.ok(Object.isFrozen(resolved) && Object.isFrozen(resolved.eligibleStudentIds));
  assert.deepEqual(resolveGymFixedGroupAssignment(state, token(ids.secondary), "gym-dated-group-strength"), { success: false, error: "No autorizado para este grupo." });
  assert.deepEqual(resolveGymFixedGroupAssignment(state, token(ids.admin), "gym-dated-group-strength"), resolved);

  const renamed = renameGymTrainingGroup(state, token(ids.primary), "gym-dated-group-strength", "Nombre nuevo").state;
  assert.deepEqual(resolveGymFixedGroupAssignment(renamed, token(ids.primary), "gym-dated-group-strength"), resolved, "historical snapshot values are not rewritten by a rename");
  const withoutMuslib = removeGymTrainingStudentFromGroup(renamed, token(ids.primary), ids.muslib, "gym-dated-group-strength").state;
  assert.deepEqual(resolveGymFixedGroupAssignment(withoutMuslib, token(ids.primary), "gym-dated-group-strength"), { success: true, groupId: "gym-dated-group-strength", teacherId: ids.primary, eligibleStudentIds: ["gym-fixed-student-muslib-lite"] });
  const deleted = deleteGymTrainingGroup(withoutMuslib, token(ids.primary), "gym-dated-group-strength", "2025-05-20T10:00:00.000Z").state;
  assert.deepEqual(resolveGymFixedGroupAssignment(deleted, token(ids.primary), "gym-dated-group-strength"), { success: false, error: "Grupo no encontrado." });
});

test("GYM state is closed and authorization failures read no hostile state; authorized invalid state has a distinct result and preserves identity", () => {
  const fixture = createGymTrainingDemoFixture();
  assert.equal(isValidGymTrainingDemoState(fixture), true);
  const wrongNamespace = { ...fixture, namespace: "demo-box-training" };
  const wrongKind = { ...fixture, kind: "BOX" };
  const persistedActor = { ...fixture, selectedActorId: ids.primary };
  const persistedProfiles = { ...fixture, profiles: [] };
  const sparse = { ...fixture, groups: new Array(2) };
  sparse.groups[0] = fixture.groups[0];
  const getter = Object.defineProperty({ ...fixture }, "wods", { enumerable: true, get() { throw new Error("must not read getter"); } });
  for (const candidate of [wrongNamespace, wrongKind, persistedActor, persistedProfiles, sparse, getter]) assert.equal(isValidGymTrainingDemoState(candidate), false);

  let reads = 0;
  const hostile = Object.defineProperty({}, "wods", { enumerable: true, get() { reads += 1; throw new Error("must not read"); } });
  const denied = createGymTrainingWod(hostile, { id: ids.primary }, "id", "2025-05-01", "x", "body", { type: "ALL" });
  rejected(hostile, denied, "No autorizado.");
  assert.equal(reads, 0);
  const invalid = createGymTrainingWod(wrongNamespace, token(ids.primary), "id", "2025-05-01", "x", "body", { type: "ALL" });
  rejected(wrongNamespace, invalid, "El estado de entrenamiento no es válido.");
  assert.deepEqual(resetGymTrainingDemoState(), fixture);
});
