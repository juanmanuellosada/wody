import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingDemoFixture } from "./training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  assignTrainingStudentToGroup,
  copyTrainingWod,
  createTrainingGroup,
  createTrainingWod,
  deleteTrainingGroup,
  deleteTrainingWod,
  projectTrainingViews,
  removeTrainingStudentFromGroup,
  renameTrainingGroup,
  resetTrainingDemoState,
  selectTrainingDemoActor,
  updateTrainingWod,
} from "./training-demo-state.ts";

function asActor(state, actorId) {
  const selected = selectTrainingDemoActor(state, actorId);
  assert.equal(selected.result.success, true);
  return selected.state;
}

test("WOD CRUD and copy preserve date-only targets and the original entity", () => {
  let state = asActor(createTrainingDemoFixture(), "t1");
  const created = createTrainingWod(state, "w-local", "2025-05-01", "  Técnica  ", "Contenido útil", { type: "GROUP", groupId: "g1" });
  assert.deepEqual(created.result, { success: true, wodId: "w-local" });
  state = created.state;
  assert.deepEqual(state.wods.at(-1), {
    id: "w-local",
    title: "Técnica",
    content: "Contenido útil",
    date: "2025-05-01",
    teacherId: "t1",
    targetType: "GROUP",
    targetGroupId: "g1",
    targetStudentId: null,
  });

  const edited = updateTrainingWod(state, "w-local", "", "Otro contenido", "2025-05-02", { type: "STUDENT", studentId: "s1" });
  assert.deepEqual(edited.result, { success: true });
  state = edited.state;
  assert.equal(state.wods.find((wod) => wod.id === "w-local")?.title, "WOD");

  const copied = copyTrainingWod(state, "w-copy", "w-local", "2025-05-03", { type: "ALL" });
  assert.deepEqual(copied.result, { success: true, wodId: "w-copy" });
  assert.equal(copied.state.wods.find((wod) => wod.id === "w-copy")?.targetType, "ALL");
  assert.equal(copied.state.wods.find((wod) => wod.id === "w-local")?.date, "2025-05-02");

  const deleted = deleteTrainingWod(copied.state, "w-local");
  assert.deepEqual(deleted.result, { success: true });
  assert.equal(deleted.state.wods.some((wod) => wod.id === "w-local"), false);
  assert.equal(deleted.state.wods.some((wod) => wod.id === "w-copy"), true);
});

test("invalid WOD commands, foreign ownership, and BOX musculación targets leave state unchanged", () => {
  const fixture = createTrainingDemoFixture();
  const teacher = asActor(fixture, "t1");
  for (const result of [
    createTrainingWod(teacher, "w-invalid", "2025-02-30", "x", "contenido", { type: "ALL" }),
    createTrainingWod(teacher, "w-invalid", "2025-05-01", "x", "   ", { type: "ALL" }),
    createTrainingWod(teacher, "w-invalid", "2025-05-01", "x", "contenido", { type: "MUSCULACION_LIBRE", studentId: "s1" }),
    createTrainingWod(teacher, "w-invalid", "2025-05-01", "x", "contenido", { type: "STUDENT", studentId: "s3" }),
  ]) {
    assert.equal(result.result.success, false);
    assert.equal(result.state, teacher);
  }
  const otherTeacher = asActor(fixture, "t2");
  assert.equal(updateTrainingWod(otherTeacher, "w1", "x", "contenido").state, otherTeacher);
  assert.equal(deleteTrainingWod(otherTeacher, "foreign-wod").state, otherTeacher);
  assert.equal(copyTrainingWod(otherTeacher, "w-copy", "w1", "2025-05-01").state, otherTeacher);

  const selfManaged = asActor(fixture, "s3");
  assert.equal(createTrainingWod(selfManaged, "w-self", "2025-05-01", "", "contenido", { type: "STUDENT", studentId: "s3" }).result.success, true);
  assert.equal(createTrainingWod(selfManaged, "w-no", "2025-05-01", "", "contenido", { type: "ALL" }).state, selfManaged);
});

test("runtime WOD input rejects malformed targets and non-strings without mutating or throwing", () => {
  const state = asActor(createTrainingDemoFixture(), "t1");
  const malformedTargets = [null, [], {}, { type: "NOT_A_TARGET" }, { type: "GROUP" }, { type: "STUDENT", studentId: "" }, { type: "ALL", groupId: "g1" }];
  for (const target of malformedTargets) {
    const created = createTrainingWod(state, "w-runtime", "2025-05-01", "Título", "contenido", target);
    assert.equal(created.result.success, false);
    assert.equal(created.state, state);
    const updated = updateTrainingWod(state, "w1", "Título", "contenido", "2025-05-01", target);
    assert.equal(updated.result.success, false);
    assert.equal(updated.state, state);
    const copied = copyTrainingWod(state, "w-copy", "w1", "2025-05-01", target);
    assert.equal(copied.result.success, false);
    assert.equal(copied.state, state);
  }
  for (const [date, title, content] of [[null, "Título", "contenido"], ["2025-05-01", null, "contenido"], ["2025-05-01", "Título", null]]) {
    const result = createTrainingWod(state, "w-runtime", date, title, content, { type: "ALL" });
    assert.equal(result.result.success, false);
    assert.equal(result.state, state);
  }
});

test("student projection follows teacher links, personalized targeting, memberships, and self routines", () => {
  let state = createTrainingDemoFixture();
  state = asActor(state, "s1");
  assert.deepEqual(projectTrainingViews(state).student.wods.map((wod) => wod.id), ["w1", "w2", "w3", "w4"]);
  assert.ok(projectTrainingViews(state).student.wods.every((wod) => wod.date instanceof Date));

  state = asActor(state, "t1");
  state = removeTrainingStudentFromGroup(state, "s1", "g1").state;
  state = asActor(state, "s1");
  assert.deepEqual(projectTrainingViews(state).student.wods.map((wod) => wod.id), ["w1", "w2", "w4"]);

  state = asActor(state, "t1");
  state = assignTrainingStudentToGroup(state, "s1", "g1").state;
  state = asActor(state, "s1");
  assert.ok(projectTrainingViews(state).student.wods.some((wod) => wod.id === "w3"));

  const general = asActor(createTrainingDemoFixture(), "s2");
  assert.deepEqual(projectTrainingViews(general).student.wods.map((wod) => wod.id), ["w1"]);
  const selfManaged = asActor(createTrainingDemoFixture(), "s3");
  assert.deepEqual(projectTrainingViews(selfManaged).student.wods.map((wod) => wod.id), ["w5", "w6"]);
});

test("staff projection remains route-scoped while group commands retain admin and teacher ownership rules", () => {
  let teacher = asActor(createTrainingDemoFixture(), "t1");
  assert.deepEqual(projectTrainingViews(teacher).staff.wods.map((wod) => wod.id), ["w1", "w2", "w3", "w4"]);
  assert.deepEqual(projectTrainingViews(teacher).staff.groups.map((group) => group.id), ["g1"]);
  assert.deepEqual(projectTrainingViews(teacher).staff.students.map((student) => student.id), ["s1"]);

  const duplicate = createTrainingGroup(teacher, "g-new", "Equipo Demo");
  assert.equal(duplicate.result.success, false);
  assert.equal(duplicate.state, teacher);
  const generalMember = assignTrainingStudentToGroup(teacher, "s2", "g1");
  assert.equal(generalMember.result.success, false);
  assert.equal(generalMember.state, teacher);
  const foreignGroup = renameTrainingGroup(teacher, "g2", "No permitido");
  assert.equal(foreignGroup.state, teacher);

  const admin = asActor(createTrainingDemoFixture(), "a1");
  const adminRename = renameTrainingGroup(admin, "g1", "Equipo Renombrado");
  assert.deepEqual(adminRename.result, { success: true });
  assert.deepEqual(projectTrainingViews(adminRename.state).staff.wods.map((wod) => wod.id), ["w7"]);
  assert.deepEqual(projectTrainingViews(adminRename.state).staff.groups, []);
});

test("soft group deletion clears memberships and target id but retains detached GROUP history", () => {
  let state = asActor(createTrainingDemoFixture(), "t1");
  const deleted = deleteTrainingGroup(state, "g1", "2025-05-01T10:00:00.000Z");
  assert.deepEqual(deleted.result, { success: true });
  state = deleted.state;
  assert.equal(state.groups.find((group) => group.id === "g1")?.deletedAt, "2025-05-01T10:00:00.000Z");
  assert.equal(state.memberships.some((membership) => membership.groupId === "g1"), false);
  const detached = state.wods.find((wod) => wod.id === "w3");
  assert.deepEqual({ type: detached?.targetType, groupId: detached?.targetGroupId }, { type: "GROUP", groupId: null });
  assert.equal(projectTrainingViews(asActor(state, "s1")).student.wods.some((wod) => wod.id === "w3"), false);
});

test("reset returns a valid deterministic actor selection without deleting unrelated records during selection", () => {
  const fixture = createTrainingDemoFixture();
  const selected = asActor(fixture, "s1");
  assert.equal(selected.wods.length, fixture.wods.length);
  const reset = resetTrainingDemoState();
  assert.equal(reset.selectedActorId, "a1");
  assert.deepEqual(reset, fixture);
});
