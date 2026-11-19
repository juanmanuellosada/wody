import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_ARCHIVED_STUDENT_ID,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID,
  GYM_DEMO_MUSLIB_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
  getGymDemoProfiles,
  getGymDemoTeacherStudentLinks,
} from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "../finance/gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  GYM_DEMO_PROFILE_NAMESPACE,
  GYM_DEMO_PROFILE_VERSION,
  assignGymDemoStudentTeacher,
  createGymDemoProfileFixture,
  editGymDemoStudent,
  getGymDemoProfileActorToken,
  getValidatedGymDemoProfileState,
  projectGymDemoProfiles,
  setGymDemoStudentBlocked,
  setGymDemoStudentOwnRoutines,
  setGymDemoStudentPaymentExempt,
  setGymDemoStudentType,
  unassignGymDemoStudentTeacher,
} from "./gym-demo-profile-core.ts";

const admin = getGymDemoProfileActorToken(GYM_DEMO_ADMIN_ID);
const teacher = getGymDemoProfileActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const unlinkedTeacher = getGymDemoProfileActorToken(GYM_DEMO_SECONDARY_TEACHER_ID);
const student = getGymDemoProfileActorToken(GYM_DEMO_PERSONALIZED_STUDENT_ID);
const noAuth = { success: false, error: "No autorizado." };

function fixture() {
  return createGymDemoProfileFixture();
}

function row(state, id) {
  const value = state.students.find((candidate) => candidate.id === id);
  assert.ok(value, `missing ${id}`);
  return value;
}

function denied(transition, original, error = noAuth.error) {
  assert.equal(transition.state, original);
  assert.deepEqual(transition.result, { success: false, error });
  assert.deepEqual(transition.effects, []);
}

test("fixture derives the exact canonical student and link graph without mutating directory or finance fixtures", () => {
  const directoryBefore = JSON.stringify({ profiles: getGymDemoProfiles(), links: getGymDemoTeacherStudentLinks() });
  const financeBefore = JSON.stringify(createGymFinanceDemoFixture());
  const state = fixture();
  assert.equal(state.namespace, GYM_DEMO_PROFILE_NAMESPACE);
  assert.equal(state.version, GYM_DEMO_PROFILE_VERSION);
  assert.equal(state.students.length, getGymDemoProfiles().filter((profile) => profile.role === "STUDENT").length);
  assert.equal(state.links.length, getGymDemoTeacherStudentLinks().length);
  row(state, GYM_DEMO_GENERAL_STUDENT_ID).name = "Local only";
  state.links.pop();
  assert.equal(JSON.stringify({ profiles: getGymDemoProfiles(), links: getGymDemoTeacherStudentLinks() }), directoryBefore);
  assert.equal(JSON.stringify(createGymFinanceDemoFixture()), financeBefore);
});

test("edit follows ADMIN/linked-TEACHER scope and normalizes name", () => {
  const initial = fixture();
  const changed = editGymDemoStudent(initial, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "  Nuevo nombre  " });
  assert.equal(changed.result.success, true);
  assert.notEqual(changed.state, initial);
  assert.equal(row(changed.state, GYM_DEMO_GENERAL_STUDENT_ID).name, "Nuevo nombre");

  const teacherChange = editGymDemoStudent(changed.state, teacher, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "Profe" });
  assert.equal(teacherChange.result.success, true);
  const teacherDenied = editGymDemoStudent(changed.state, unlinkedTeacher, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "No" });
  denied(teacherDenied, changed.state, "Este alumno no está asignado a vos.");
  const empty = editGymDemoStudent(changed.state, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: " \n " });
  denied(empty, changed.state, "El nombre no puede estar vacío.");
  denied(editGymDemoStudent(changed.state, student, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "No" }), changed.state);
});

test("block is admin-only STUDENT metadata with an explicit clock and no implied financial action", () => {
  const initial = fixture();
  const blocked = setGymDemoStudentBlocked(initial, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: true }, () => "2030-06-03T12:00:00.000Z");
  assert.equal(blocked.result.success, true);
  assert.equal(row(blocked.state, GYM_DEMO_GENERAL_STUDENT_ID).blockedAt, "2030-06-03T12:00:00.000Z");
  const unblocked = setGymDemoStudentBlocked(blocked.state, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: false });
  assert.equal(row(unblocked.state, GYM_DEMO_GENERAL_STUDENT_ID).blockedAt, null);
  const missingClock = setGymDemoStudentBlocked(initial, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: true });
  denied(missingClock, initial, "El comando de perfiles de demostración no es válido.");
  denied(setGymDemoStudentBlocked(initial, teacher, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: true }, () => "x"), initial);
});

test("payment exemption preserves its normalized reason when disabling", () => {
  const initial = fixture();
  const enabled = setGymDemoStudentPaymentExempt(initial, admin, { studentId: GYM_DEMO_MUSLIB_STUDENT_ID, exempt: true, reason: "  Beca  " });
  assert.equal(enabled.result.success, true);
  const disabled = setGymDemoStudentPaymentExempt(enabled.state, admin, { studentId: GYM_DEMO_MUSLIB_STUDENT_ID, exempt: false, reason: "  Motivo conservado " });
  assert.equal(row(disabled.state, GYM_DEMO_MUSLIB_STUDENT_ID).paymentExempt, false);
  assert.equal(row(disabled.state, GYM_DEMO_MUSLIB_STUDENT_ID).paymentExemptReason, "Motivo conservado");
  assert.equal(setGymDemoStudentPaymentExempt(disabled.state, admin, { studentId: GYM_DEMO_MUSLIB_STUDENT_ID, exempt: false, reason: "  " }).state.students.find((entry) => entry.id === GYM_DEMO_MUSLIB_STUDENT_ID)?.paymentExemptReason, null);
});

test("type behavior preserves production teacher scope and returns only a declarative group effect", () => {
  const initial = fixture();
  const general = setGymDemoStudentType(initial, unlinkedTeacher, { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, studentType: "GENERAL" });
  assert.equal(general.result.success, true, "production setStudentType does not impose TeacherStudent ownership");
  assert.equal(row(general.state, GYM_DEMO_PERSONALIZED_STUDENT_ID).canCreateOwnRoutines, false);
  assert.deepEqual(general.effects, [{ type: "DETACH_ALL_GROUPS", studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID }]);
  assert.equal(initial.links.length, general.state.links.length, "the profile core never writes group state");

  const muslib = setGymDemoStudentType(general.state, admin, { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, studentType: "MUSCULACION_LIBRE" });
  assert.equal(row(muslib.state, GYM_DEMO_PERSONALIZED_STUDENT_ID).studentType, "MUSCULACION_LIBRE");
  assert.equal(row(muslib.state, GYM_DEMO_PERSONALIZED_STUDENT_ID).canCreateOwnRoutines, false);
  assert.deepEqual(muslib.effects, []);

  const personalized = setGymDemoStudentType(muslib.state, admin, { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, studentType: "PERSONALIZED" });
  assert.equal(row(personalized.state, GYM_DEMO_PERSONALIZED_STUDENT_ID).canCreateOwnRoutines, false, "PERSONALIZED preserves the flag");
  const lite = setGymDemoStudentType(initial, admin, { studentId: GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, studentType: "GENERAL" });
  denied(lite, initial, "El tipo de alumno no aplica a alumnos lite. Convertilo a cuenta completa primero.");
});

test("own-routines command is admin/FULL/PERSONALIZED-only and cannot disable an unlinked student", () => {
  const initial = fixture();
  const deniedUnlinked = setGymDemoStudentOwnRoutines(initial, admin, { studentId: GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, canCreateOwnRoutines: false });
  denied(deniedUnlinked, initial, "El alumno no tiene profe asignado: no podés desactivarlo.");
  const set = setGymDemoStudentOwnRoutines(initial, admin, { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, canCreateOwnRoutines: true });
  assert.equal(set.result.success, true);
  const general = setGymDemoStudentOwnRoutines(initial, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, canCreateOwnRoutines: true });
  denied(general, initial, "Solo alumnos personalizados pueden autogestionar rutinas.");
  const lite = setGymDemoStudentOwnRoutines(initial, admin, { studentId: GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, canCreateOwnRoutines: true });
  denied(lite, initial, "La opción de rutinas propias no aplica a alumnos lite. Convertilo a cuenta completa primero.");
  denied(setGymDemoStudentOwnRoutines(initial, teacher, { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, canCreateOwnRoutines: true }), initial);
});

test("assignment uses fresh mutable links, accepts ADMIN targets, and rejects duplicates", () => {
  const initial = fixture();
  const assigned = assignGymDemoStudentTeacher(initial, admin, { teacherId: GYM_DEMO_ADMIN_ID, studentId: GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID });
  assert.equal(assigned.result.success, true);
  assert.ok(assigned.state.links.some((link) => link.teacherId === GYM_DEMO_ADMIN_ID && link.studentId === GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID));
  const duplicate = assignGymDemoStudentTeacher(assigned.state, admin, { teacherId: GYM_DEMO_ADMIN_ID, studentId: GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID });
  denied(duplicate, assigned.state, "Ese alumno ya está asignado a ese profe.");
  const badTeacher = assignGymDemoStudentTeacher(initial, admin, { teacherId: GYM_DEMO_GENERAL_STUDENT_ID, studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID });
  denied(badTeacher, initial, "El profe no existe o no tiene el rol correcto.");
  const assignedSecondary = assignGymDemoStudentTeacher(assigned.state, admin, { teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, studentId: GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID });
  const freshTeacherScope = editGymDemoStudent(assignedSecondary.state, unlinkedTeacher, { studentId: GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, name: "Administrado" });
  assert.equal(freshTeacherScope.result.success, true);
});

test("unassignment preserves the production last-link inconsistency for all FULL types, but never LITE", () => {
  for (const studentId of [GYM_DEMO_GENERAL_STUDENT_ID, GYM_DEMO_MUSLIB_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID]) {
    const outcome = unassignGymDemoStudentTeacher(fixture(), admin, { teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId });
    assert.equal(outcome.result.success, true, studentId);
    assert.equal(row(outcome.state, studentId).canCreateOwnRoutines, true, studentId);
  }
  const lite = unassignGymDemoStudentTeacher(fixture(), admin, { teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID });
  assert.equal(lite.result.success, true);
  assert.equal(row(lite.state, GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID).canCreateOwnRoutines, false);

  const two = assignGymDemoStudentTeacher(fixture(), admin, { teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID });
  const nonlast = unassignGymDemoStudentTeacher(two.state, admin, { teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID });
  assert.equal(row(nonlast.state, GYM_DEMO_PERSONALIZED_STUDENT_ID).canCreateOwnRoutines, false);
  const missingSource = fixture();
  denied(unassignGymDemoStudentTeacher(missingSource, admin, { teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID }), missingSource, "La asignación no existe.");
});

test("state and commands are captured safely: getters, symbols, custom prototypes, sparse arrays, and key drift are rejected", () => {
  const valid = fixture();
  assert.ok(getValidatedGymDemoProfileState(Object.freeze(valid)));
  const getter = fixture();
  Object.defineProperty(getter, "students", { enumerable: true, get() { throw new Error("must not read getter"); } });
  assert.equal(getValidatedGymDemoProfileState(getter), null);
  const symbol = fixture();
  symbol[Symbol("extra")] = true;
  assert.equal(getValidatedGymDemoProfileState(symbol), null);
  assert.equal(getValidatedGymDemoProfileState(Object.assign(Object.create(null), fixture())), null);
  const sparse = fixture();
  sparse.students = new Array(1);
  assert.equal(getValidatedGymDemoProfileState(sparse), null);

  let rounds = 0;
  const drifting = new Proxy({ studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "X" }, {
    ownKeys() { rounds += 1; return rounds === 1 ? ["studentId", "name"] : ["studentId"]; },
    getOwnPropertyDescriptor(target, key) { return Object.getOwnPropertyDescriptor(target, key); },
  });
  const outcome = editGymDemoStudent(valid, admin, drifting);
  denied(outcome, valid, "El comando de perfiles de demostración no es válido.");
  assert.equal(rounds, 2, "descriptor capture detects key-map drift without a third source enumeration");
});

test("all commands fail closed for a non-canonical actor and archived targets", () => {
  const initial = fixture();
  const commands = [
    () => editGymDemoStudent(initial, {}, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "X" }),
    () => setGymDemoStudentBlocked(initial, {}, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, blocked: false }),
    () => setGymDemoStudentPaymentExempt(initial, {}, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, exempt: false, reason: null }),
    () => setGymDemoStudentType(initial, {}, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, studentType: "GENERAL" }),
    () => setGymDemoStudentOwnRoutines(initial, {}, { studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID, canCreateOwnRoutines: true }),
    () => assignGymDemoStudentTeacher(initial, {}, { teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_GENERAL_STUDENT_ID }),
    () => unassignGymDemoStudentTeacher(initial, {}, { teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_GENERAL_STUDENT_ID }),
  ];
  for (const invoke of commands) denied(invoke(), initial);
  const archived = editGymDemoStudent(initial, admin, { studentId: GYM_DEMO_ARCHIVED_STUDENT_ID, name: "No" });
  denied(archived, initial, "Alumno no encontrado.");
});

test("opaque actor checks and invalid context happen before commands; success is detached and projections are detached", () => {
  const initial = fixture();
  let commandReads = 0;
  const hostile = new Proxy({}, { ownKeys() { commandReads += 1; throw new Error("must not read"); } });
  denied(editGymDemoStudent(initial, {}, hostile), initial);
  assert.equal(commandReads, 0);
  const invalid = { namespace: "wody-box-finance-demo", version: 1, students: hostile, links: [] };
  const invalidResult = editGymDemoStudent(invalid, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "X" });
  denied(invalidResult, invalid, "El estado de perfiles de demostración no es válido.");
  assert.equal(commandReads, 0, "foreign namespace fails root validation before child traversal");

  const changed = editGymDemoStudent(initial, admin, { studentId: GYM_DEMO_GENERAL_STUDENT_ID, name: "Detached" });
  assert.notEqual(changed.state, initial);
  const projection = projectGymDemoProfiles(changed.state);
  assert.ok(projection);
  projection.students[0].name = "Projection only";
  assert.notEqual(projection.students[0].name, changed.state.students[0].name);
});
