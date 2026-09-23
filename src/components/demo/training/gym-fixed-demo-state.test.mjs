import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedDemoFixture, getGymFixedDemoRoster } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  createGymFixedRoutine,
  createGymFixedRoutineForGroup,
  deleteGymFixedRoutine,
  getGymFixedDemoActorToken,
  getGymFixedDemoGroupEligibility,
  isGymFixedDemoDate,
  isValidGymFixedDemoState,
  projectGymFixedAssignmentContext,
  projectGymFixedRenewals,
  projectGymFixedStudentRoutine,
  renewGymFixedRoutine,
  resetGymFixedDemoState,
  updateGymFixedRoutine,
} from "./gym-fixed-demo-state.ts";

const now = () => new Date("2025-05-10T14:30:00.000Z");
const token = (id) => {
  const value = getGymFixedDemoActorToken(id);
  assert.ok(value, `missing token ${id}`);
  return value;
};
const admin = () => token("gym-fixed-admin");
const linkedTeacher = () => token("gym-fixed-teacher-linked");
const unlinkedTeacher = () => token("gym-fixed-teacher-unlinked");
const muslib = () => token("gym-fixed-student-muslib");

function routineCommand(id, studentId, extra = {}) {
  return { id, studentId, title: "  Fuerza A  ", content: "3 x 8", renewAt: "2025-06-10", ...extra };
}

function assertRejected(initial, transition) {
  assert.equal(transition.result.success, false);
  assert.equal(transition.state, initial);
}

test("individual creation mirrors GYM authorization, accepts all three active student types, and preserves serialized dates", () => {
  let state = createGymFixedDemoFixture();
  for (const [id, studentId] of [
    ["gym-fixed-general", "gym-fixed-student-general"],
    ["gym-fixed-personalized", "gym-fixed-student-personalized"],
    ["gym-fixed-muslib", "gym-fixed-student-muslib"],
  ]) {
    const created = createGymFixedRoutine(state, linkedTeacher(), routineCommand(id, studentId, { content: "  Body  " }), now);
    assert.deepEqual(created.result, { success: true, id });
    state = created.state;
  }
  assert.deepEqual(state.fixedRoutines.at(-1), {
    id: "gym-fixed-muslib", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked",
    title: "Fuerza A", content: "Body", assignedAt: "2025-05-10T14:30:00.000Z", renewAt: "2025-06-10", deletedAt: null,
  });
  const defaulted = createGymFixedRoutine(state, linkedTeacher(), routineCommand("gym-fixed-default", "gym-fixed-student-muslib", { renewAt: "  " }), now);
  assert.equal(defaulted.state.fixedRoutines.at(-1).renewAt, "2025-06-09", "live default is assignedAt plus 30 days, normalized to @db.Date");

  const noLinkState = createGymFixedDemoFixture();
  assertRejected(noLinkState, createGymFixedRoutine(noLinkState, unlinkedTeacher(), routineCommand("no-link", "gym-fixed-student-muslib"), now));
  assert.equal(createGymFixedRoutine(createGymFixedDemoFixture(), admin(), routineCommand("admin-bypass", "gym-fixed-student-muslib"), now).result.success, true);
  for (const studentId of ["gym-fixed-student-muslib-lite", "gym-fixed-student-muslib-archived", "gym-fixed-foreign-student", "missing"]) {
    const initial = createGymFixedDemoFixture();
    assertRejected(initial, createGymFixedRoutine(initial, linkedTeacher(), routineCommand(`bad-${studentId}`, studentId), now));
  }
});

test("ownership, update/renew/delete, soft deletion, and latest active student DTO match the source behavior", () => {
  const initial = createGymFixedDemoFixture();
  // fixed-routine.ts: update 226–236, renew 294–303, delete 339–348 distinguish ownership from a missing scoped routine.
  for (const transition of [
    updateGymFixedRoutine(initial, unlinkedTeacher(), { routineId: "gym-fixed-active", title: "x", content: "x" }),
    renewGymFixedRoutine(initial, unlinkedTeacher(), { routineId: "gym-fixed-active", renewAt: "2025-06-02" }),
    deleteGymFixedRoutine(initial, unlinkedTeacher(), { routineId: "gym-fixed-active" }, now),
  ]) {
    assert.deepEqual(transition.result, { success: false, error: "No autorizado." });
    assert.equal(transition.state, initial);
  }
  for (const transition of [
    updateGymFixedRoutine(initial, admin(), { routineId: "missing", title: "x", content: "x" }),
    renewGymFixedRoutine(initial, admin(), { routineId: "missing", renewAt: "2025-06-02" }),
    deleteGymFixedRoutine(initial, admin(), { routineId: "missing" }, now),
  ]) assert.deepEqual(transition.result, { success: false, error: "Rutina no encontrada." });
  const adminEdited = updateGymFixedRoutine(initial, admin(), { routineId: "gym-fixed-active", title: "  Administración  ", content: "  Body  ", renewAt: "" });
  assert.deepEqual(adminEdited.result, { success: true });
  assert.equal(adminEdited.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").content, "Body");
  assert.equal(adminEdited.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").renewAt, "2025-05-30");
  const renewed = renewGymFixedRoutine(adminEdited.state, admin(), { routineId: "gym-fixed-active", renewAt: "2025-06-02" });
  assert.equal(renewed.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").renewAt, "2025-06-02");
  const deleted = deleteGymFixedRoutine(renewed.state, linkedTeacher(), { routineId: "gym-fixed-active" }, now);
  assert.deepEqual(deleted.result, { success: true });
  assert.equal(deleted.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").deletedAt, "2025-05-10T14:30:00.000Z");
  const dto = projectGymFixedStudentRoutine(deleted.state, muslib());
  assert.equal(dto.id, "gym-fixed-history", "soft-deleted latest record is excluded and history remains");
  assert.ok(dto.assignedAt instanceof Date && dto.renewAt instanceof Date);
  assert.equal(dto.renewAt.toISOString(), "2025-05-01T00:00:00.000Z");
  assert.equal(projectGymFixedStudentRoutine(deleted.state, token("gym-fixed-student-general")), null);
});

test("group batch is atomic, scopes teachers and admin foreign groups, and deliberately includes LITE muslib members like the live action", () => {
  const initial = createGymFixedDemoFixture();
  const group = {
    groupId: "gym-fixed-group-linked", ids: ["gym-fixed-group-a", "gym-fixed-group-b"], title: "Grupo", content: "  Body  ", renewAt: "2025-06-10",
  };
  const created = createGymFixedRoutineForGroup(initial, linkedTeacher(), group, now);
  assert.deepEqual(created.result, { success: true, count: 2 });
  assert.deepEqual(created.state.fixedRoutines.slice(-2).map((routine) => [routine.studentId, routine.teacherId, routine.content]), [
    ["gym-fixed-student-muslib", "gym-fixed-teacher-linked", "Body"],
    ["gym-fixed-student-muslib-lite", "gym-fixed-teacher-linked", "Body"],
  ]);
  for (const bad of [
    { ...group, ids: ["only-one"] },
    { ...group, ids: ["duplicate", "duplicate"] },
    { ...group, ids: ["gym-fixed-active", "fresh"] },
    { ...group, groupId: "gym-fixed-group-unlinked" },
    { ...group, groupId: "gym-fixed-group-foreign" },
  ]) {
    assertRejected(initial, createGymFixedRoutineForGroup(initial, linkedTeacher(), bad, now));
  }
  assertRejected(initial, createGymFixedRoutineForGroup(initial, admin(), { ...group, groupId: "gym-fixed-group-foreign" }, now));
  assert.equal(createGymFixedRoutineForGroup(initial, admin(), group, now).result.success, true, "ADMIN validates a local group teacher but bypasses teacher ownership");
});

test("shared group eligibility keeps core ordering, LITE parity, errors, and detached adapter IDs", () => {
  const eligible = getGymFixedDemoGroupEligibility(linkedTeacher(), "gym-fixed-group-linked");
  assert.deepEqual(eligible, {
    success: true,
    studentIds: ["gym-fixed-student-muslib", "gym-fixed-student-muslib-lite"],
  });
  assert.notEqual(eligible.studentIds, getGymFixedDemoGroupEligibility(linkedTeacher(), "gym-fixed-group-linked").studentIds);
  eligible.studentIds.reverse();
  assert.deepEqual(getGymFixedDemoGroupEligibility(linkedTeacher(), "gym-fixed-group-linked"), {
    success: true,
    studentIds: ["gym-fixed-student-muslib", "gym-fixed-student-muslib-lite"],
  });
  assert.deepEqual(getGymFixedDemoGroupEligibility(unlinkedTeacher(), "gym-fixed-group-linked"), {
    success: false,
    error: "No autorizado para este grupo.",
  });
  assert.deepEqual(getGymFixedDemoGroupEligibility(admin(), "gym-fixed-group-foreign"), {
    success: false,
    error: "Grupo no encontrado.",
  });
  assert.deepEqual(getGymFixedDemoGroupEligibility(linkedTeacher(), "missing"), {
    success: false,
    error: "Grupo no encontrado.",
  });
  assert.deepEqual(getGymFixedDemoGroupEligibility(token("gym-fixed-student-muslib"), Object.defineProperty({}, "id", {
    enumerable: true,
    get() { throw new Error("must not inspect group"); },
  })), { success: false, error: "No autorizado." });
});

test("all command paths trim content and normalize the action parser's overflowing renewal dates without accepting NaN dates", () => {
  const initial = createGymFixedDemoFixture();
  // fixed-routine.ts: create 162–186, update 240–256, group 415–461 trim content and accept Date's calendar overflow normalization.
  const created = createGymFixedRoutine(initial, linkedTeacher(), routineCommand("normalized-create", "gym-fixed-student-muslib", { content: "  Body  ", renewAt: " 2025-02-29 " }), now);
  assert.deepEqual(created.result, { success: true, id: "normalized-create" });
  assert.deepEqual(created.state.fixedRoutines.at(-1).content, "Body");
  assert.equal(created.state.fixedRoutines.at(-1).renewAt, "2025-03-01");
  const grouped = createGymFixedRoutineForGroup(initial, linkedTeacher(), {
    groupId: "gym-fixed-group-linked", ids: ["normalized-group-a", "normalized-group-b"], title: "Grupo", content: "  Body  ", renewAt: "2025-02-30",
  }, now);
  assert.equal(grouped.result.success, true);
  assert.ok(grouped.state.fixedRoutines.slice(-2).every((routine) => routine.content === "Body" && routine.renewAt === "2025-03-02"));
  const updated = updateGymFixedRoutine(initial, linkedTeacher(), { routineId: "gym-fixed-active", title: "Título", content: "  Body  ", renewAt: "2025-02-29" });
  assert.equal(updated.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").renewAt, "2025-03-01");
  assert.equal(updated.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").content, "Body");
  const renewed = renewGymFixedRoutine(initial, linkedTeacher(), { routineId: "gym-fixed-active", renewAt: "2025-02-30" });
  assert.equal(renewed.state.fixedRoutines.find((routine) => routine.id === "gym-fixed-active").renewAt, "2025-03-02");
  for (const transition of [
    createGymFixedRoutine(initial, linkedTeacher(), routineCommand("bad-date", "gym-fixed-student-muslib", { renewAt: "not-a-date" }), now),
    createGymFixedRoutineForGroup(initial, linkedTeacher(), { groupId: "gym-fixed-group-linked", ids: ["bad-a", "bad-b"], title: "Grupo", content: "Body", renewAt: "not-a-date" }, now),
    updateGymFixedRoutine(initial, linkedTeacher(), { routineId: "gym-fixed-active", title: "Título", content: "Body", renewAt: "not-a-date" }),
    renewGymFixedRoutine(initial, linkedTeacher(), { routineId: "gym-fixed-active", renewAt: "not-a-date" }),
  ]) assertRejected(initial, transition);
  for (const transition of [
    createGymFixedRoutine(initial, linkedTeacher(), routineCommand("blank-create", "gym-fixed-student-muslib", { content: "  " }), now),
    updateGymFixedRoutine(initial, linkedTeacher(), { routineId: "gym-fixed-active", title: "Título", content: "  " }),
    createGymFixedRoutineForGroup(initial, linkedTeacher(), { groupId: "gym-fixed-group-linked", ids: ["blank-a", "blank-b"], title: "Grupo", content: "  " }, now),
  ]) {
    assert.deepEqual(transition.result, { success: false, error: "El contenido es obligatorio." });
    assert.equal(transition.state, initial);
  }
});

test("renewal projection preserves Prisma renewAt-ascending Map insertion order across replacement and ties", () => {
  const state = {
    version: 1,
    namespace: "demo-gym-fixed-routines/v1",
    fixedRoutines: [
      { id: "cross-a-early", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked", title: "A", content: "A", assignedAt: "2025-05-01T00:00:00.000Z", renewAt: "2025-05-26", deletedAt: null },
      { id: "cross-b", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-personalized", teacherId: "gym-fixed-teacher-unlinked", title: "B", content: "B", assignedAt: "2025-05-01T00:00:00.000Z", renewAt: "2025-05-27", deletedAt: null },
      { id: "cross-a-late", gymId: "gym-fixed-gym", studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked", title: "A2", content: "A2", assignedAt: "2025-05-02T00:00:00.000Z", renewAt: "2025-05-28", deletedAt: null },
    ],
  };
  assert.equal(isValidGymFixedDemoState(state), true);
  // fixed-routine.ts: 62–70 and 102–110 retain Map insertion order after replacement.
  assert.deepEqual(projectGymFixedRenewals(state, admin(), "2025-05-21").map((routine) => routine.id), ["cross-a-late", "cross-b"]);
  assert.deepEqual(projectGymFixedRenewals(state, linkedTeacher(), "2025-05-21").map((routine) => routine.id), ["cross-a-late"]);
  const ties = { ...state, fixedRoutines: [
    { ...state.fixedRoutines[0], id: "tie-first", renewAt: "2025-05-26" },
    { ...state.fixedRoutines[1], id: "tie-second", renewAt: "2025-05-26" },
    { ...state.fixedRoutines[2], id: "tie-replacement", renewAt: "2025-05-26" },
  ] };
  assert.deepEqual(projectGymFixedRenewals(ties, admin(), "2025-05-21").map((routine) => routine.id), ["tie-first", "tie-second"]);
});

test("closed commands and closed state reject malformed fields, symbols, sparse arrays, getters, dates, and namespace or kind-forgery without mutation", () => {
  const state = createGymFixedDemoFixture();
  const valid = routineCommand("safe", "gym-fixed-student-muslib");
  const malformed = [
    null, [], { ...valid, unexpected: true }, { ...valid, renewAt: "not-a-date" }, { ...valid, title: "  " }, { ...valid, content: "  " },
    { ...valid, id: "" }, Object.defineProperty({}, "id", { enumerable: true, get() { throw new Error("read"); } }),
  ];
  const symbolic = { ...valid };
  symbolic[Symbol("unknown")] = true;
  malformed.push(symbolic);
  for (const command of malformed) assertRejected(state, createGymFixedRoutine(state, linkedTeacher(), command, now));
  const sparse = { groupId: "gym-fixed-group-linked", ids: new Array(2), title: "x", content: "x" };
  sparse.ids[0] = "one";
  assertRejected(state, createGymFixedRoutineForGroup(state, linkedTeacher(), sparse, now));
  for (const date of ["2025-02-30", "0001-02-29", "0004-02-29", "0000-01-01"]) {
    assert.equal(isGymFixedDemoDate(date), date === "0004-02-29" || date === "0000-01-01");
  }
  const badState = { ...state, namespace: "demo-box-training" };
  assert.equal(isValidGymFixedDemoState(badState), false);
  assertRejected(badState, createGymFixedRoutine(badState, linkedTeacher(), valid, now));
  const protoState = Object.create(state);
  assert.equal(isValidGymFixedDemoState(protoState), false);
  assertRejected(protoState, createGymFixedRoutine(protoState, linkedTeacher(), valid, now));
});

test("authorization is private and stable despite exported fixture mutations; hostile actors cannot read state, IDs, or the clock", () => {
  const exported = getGymFixedDemoRoster();
  exported[0].role = "STUDENT";
  exported.push({ id: "forged", gymId: "gym-fixed-gym", name: "forged", role: "ADMIN", studentType: null, accountKind: "FULL", deletedAt: null });
  assert.equal(createGymFixedRoutine(createGymFixedDemoFixture(), admin(), routineCommand("stable", "gym-fixed-student-muslib"), now).result.success, true);

  let reads = 0;
  const hostileState = Object.defineProperty({}, "fixedRoutines", { get() { reads += 1; throw new Error("state read"); } });
  const hostileActors = [
    { id: "gym-fixed-admin", role: "ADMIN" },
    Object.create({ id: "gym-fixed-admin" }),
    Object.defineProperty({}, "id", { get() { throw new Error("actor read"); } }),
    Proxy.revocable({ id: "gym-fixed-admin" }, {}).proxy,
    token("gym-fixed-student-muslib"),
  ];
  for (const actor of hostileActors) {
    const result = createGymFixedRoutine(hostileState, actor, routineCommand("never", "gym-fixed-student-muslib"), () => { reads += 1; return now(); });
    assert.equal(result.result.success, false);
  }
  assert.equal(reads, 0);
  assert.equal(projectGymFixedStudentRoutine(hostileState, { id: "gym-fixed-student-muslib" }), null);
  assert.equal(reads, 0);
});

test("detached context and projections respect group ownership, soft deletion, renewal scope, reset isolation, and empty valid ledgers", () => {
  const state = createGymFixedDemoFixture();
  const teacherContext = projectGymFixedAssignmentContext(state, linkedTeacher());
  assert.deepEqual(teacherContext.muslibStudents.map((student) => student.id), ["gym-fixed-student-muslib-lite", "gym-fixed-student-muslib"]);
  assert.deepEqual(teacherContext.groups.map((group) => group.id), ["gym-fixed-group-linked"]);
  teacherContext.muslibStudents[0].name = "mutated";
  assert.notEqual(projectGymFixedAssignmentContext(state, linkedTeacher()).muslibStudents[0].name, "mutated");
  const adminContext = projectGymFixedAssignmentContext(state, admin());
  assert.ok(adminContext.muslibStudents.some((student) => student.id === "gym-fixed-student-muslib-archived") === false);
  assert.deepEqual(projectGymFixedAssignmentContext(state, token("gym-fixed-student-muslib")), null);

  const teacherRenewals = projectGymFixedRenewals(state, linkedTeacher(), "2025-05-25");
  assert.deepEqual(teacherRenewals.map((routine) => routine.id), ["gym-fixed-active"], "most recent renewAt per student mirrors the live helper");
  const adminRenewals = projectGymFixedRenewals(state, admin(), "2025-05-28");
  assert.ok(adminRenewals.some((routine) => routine.id === "gym-fixed-other-teacher"));
  assert.equal(projectGymFixedRenewals(state, unlinkedTeacher(), "2025-05-25").length, 0);
  assert.equal(projectGymFixedRenewals(state, { id: "gym-fixed-admin" }, "2025-05-25"), null);

  const empty = { version: 1, namespace: "demo-gym-fixed-routines/v1", fixedRoutines: [] };
  assert.equal(isValidGymFixedDemoState(empty), true);
  assert.deepEqual(projectGymFixedRenewals(empty, admin(), "2025-05-25"), []);
  const reset = resetGymFixedDemoState();
  assert.deepEqual(reset, createGymFixedDemoFixture());
  assert.notEqual(reset, state);
});
