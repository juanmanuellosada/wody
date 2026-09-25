import assert from "node:assert/strict";
import test from "node:test";
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
} from "../scenarios/gym-demo-directory.ts";
import {
  activeGymTurnosActor,
  applyGymTurnosBookingNameOverrides,
  applyGymTurnosStudentOptionNameOverrides,
  gymTurnosBookingRevision,
  gymTurnosListRevision,
  gymTurnosMyTurnosRevision,
  gymTurnosRowsRevision,
  gymTurnosSessionsRevision,
  gymTurnosSlotsRevision,
  gymTurnosStudents,
  gymTurnosTeachers,
  isGymTurnosStaff,
  resolveGymTurnosDisplayName,
  selectInitialGymTurnosActor,
  toGymTurnosManagementActivityInput,
  visibleGymTurnosActivityIds,
} from "./gym-turnos-demo-adapters.ts";
import { createGymTurnosDemoState, selectGymTurnosDemoActor } from "./gym-turnos-demo-state.ts";

const anchor = "2030-06-03";

function baseState() {
  return createGymTurnosDemoState(anchor);
}

test("activeGymTurnosActor returns the actor matching activeActorId", () => {
  const state = baseState();
  assert.equal(activeGymTurnosActor(state).id, GYM_DEMO_ADMIN_ID);
});

test("activeGymTurnosActor throws when activeActorId matches no actor", () => {
  const state = { ...baseState(), activeActorId: "no-such-actor" };
  assert.throws(() => activeGymTurnosActor(state));
});

test("isGymTurnosStaff is true for ADMIN and TEACHER, false for STUDENT", () => {
  const state = baseState();
  const admin = state.actors.find((actor) => actor.id === GYM_DEMO_ADMIN_ID);
  const teacher = state.actors.find((actor) => actor.id === GYM_DEMO_PRIMARY_TEACHER_ID);
  const student = state.actors.find((actor) => actor.id === GYM_DEMO_GENERAL_STUDENT_ID);
  assert.equal(isGymTurnosStaff(admin), true);
  assert.equal(isGymTurnosStaff(teacher), true);
  assert.equal(isGymTurnosStaff(student), false);
});

test("gymTurnosStudents returns only STUDENT actors", () => {
  const state = baseState();
  const students = gymTurnosStudents(state);
  assert.ok(students.length > 0);
  assert.ok(students.every((actor) => actor.role === "STUDENT"));
  assert.ok(!students.some((actor) => actor.id === GYM_DEMO_ADMIN_ID));
});

test("gymTurnosTeachers maps only TEACHER actors to {id, name}", () => {
  const state = baseState();
  const teachers = gymTurnosTeachers(state);
  assert.deepEqual(
    teachers.sort((left, right) => left.id.localeCompare(right.id)),
    [GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID]
      .sort()
      .map((id) => ({ id, name: state.actors.find((actor) => actor.id === id).name })),
  );
  assert.ok(!teachers.some((teacher) => teacher.id === GYM_DEMO_ADMIN_ID));
});

test("visibleGymTurnosActivityIds: ADMIN sees every activity", () => {
  const state = baseState();
  const visible = visibleGymTurnosActivityIds(state);
  assert.deepEqual([...visible].sort(), state.activities.map((activity) => activity.id).sort());
});

test("visibleGymTurnosActivityIds: TEACHER sees only their own activities", () => {
  const state = selectGymTurnosDemoActor(baseState(), GYM_DEMO_PRIMARY_TEACHER_ID).state;
  const visible = visibleGymTurnosActivityIds(state);
  assert.deepEqual([...visible], ["activity-spinning"]);
});

test("visibleGymTurnosActivityIds: STUDENT sees no management activities", () => {
  const state = selectGymTurnosDemoActor(baseState(), GYM_DEMO_GENERAL_STUDENT_ID).state;
  assert.deepEqual([...visibleGymTurnosActivityIds(state)], []);
});

test("toGymTurnosManagementActivityInput keeps an explicit teacherId even when an existing activity is supplied", () => {
  const input = { name: "X", description: null, scheduleKind: "WEEKLY", allowsRecurring: true, cancelWindowHours: 1, capacity: null, startsOn: anchor, endsOn: null, teacherId: GYM_DEMO_PRIMARY_TEACHER_ID };
  const existing = { id: "a", name: "X", description: null, teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, teacherName: "y", scheduleKind: "WEEKLY", allowsRecurring: true, cancelWindowHours: 1, capacity: null, startsOn: anchor, endsOn: null, active: true };
  assert.equal(toGymTurnosManagementActivityInput(input, existing).teacherId, GYM_DEMO_PRIMARY_TEACHER_ID);
});

test("toGymTurnosManagementActivityInput falls back to the existing teacherId when the dialog omits it", () => {
  const input = { name: "X", description: null, scheduleKind: "WEEKLY", allowsRecurring: true, cancelWindowHours: 1, capacity: null, startsOn: anchor, endsOn: null };
  const existing = { id: "a", name: "X", description: null, teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, teacherName: "y", scheduleKind: "WEEKLY", allowsRecurring: true, cancelWindowHours: 1, capacity: null, startsOn: anchor, endsOn: null, active: true };
  assert.equal(toGymTurnosManagementActivityInput(input, existing).teacherId, GYM_DEMO_SECONDARY_TEACHER_ID);
});

test("toGymTurnosManagementActivityInput falls back to null with no teacherId anywhere", () => {
  const input = { name: "X", description: null, scheduleKind: "ONE_OFF", allowsRecurring: false, cancelWindowHours: 1, capacity: null, startsOn: null, endsOn: null };
  assert.equal(toGymTurnosManagementActivityInput(input).teacherId, null);
});

test("gymTurnosRowsRevision folds id and name so a name-only change is a different revision", () => {
  const before = gymTurnosRowsRevision([{ id: "s-1", name: "Leon Acosta" }]);
  const after = gymTurnosRowsRevision([{ id: "s-1", name: "Leon Editado" }]);
  assert.notEqual(before, after);
});

test("gymTurnosRowsRevision changes when addedByStaff changes, previously unfolded", () => {
  const base = [{ bookingId: "b-1", userId: "s-1", name: "Ana", accountKind: "FULL", addedByStaff: false }];
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision([{ ...base[0], addedByStaff: true }]));
});

test("gymTurnosRowsRevision changes when accountKind changes, previously unfolded", () => {
  const base = [{ id: "s-1", name: "Ana", accountKind: "FULL" }];
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision([{ ...base[0], accountKind: "LITE" }]));
});

function studentSessionRow(overrides = {}) {
  return {
    id: "session-1",
    slotId: "slot-1",
    dayOfWeek: 3,
    activityName: "Spinning",
    allowsRecurring: true,
    date: "2030-06-05",
    startsAt: "2030-06-05T21:00:00.000Z",
    endsAt: "2030-06-05T22:00:00.000Z",
    capacity: 3,
    bookedCount: 1,
    cancelled: false,
    bookingId: "b-1",
    enrolledSlot: false,
    ...overrides,
  };
}

test("gymTurnosRowsRevision (GymBookingDemo's calendar key) changes when id/bookingId/bookedCount/enrolledSlot/cancelled change", () => {
  const base = [studentSessionRow()];
  const revision = gymTurnosRowsRevision(base);
  assert.notEqual(revision, gymTurnosRowsRevision([studentSessionRow({ bookingId: "b-2" })]));
  assert.notEqual(revision, gymTurnosRowsRevision([studentSessionRow({ bookedCount: 2 })]));
  assert.notEqual(revision, gymTurnosRowsRevision([studentSessionRow({ enrolledSlot: true })]));
  assert.notEqual(revision, gymTurnosRowsRevision([studentSessionRow({ cancelled: true })]));
});

test("gymTurnosRowsRevision (calendar key) changes when capacity changes, previously unfolded", () => {
  const base = [studentSessionRow()];
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision([studentSessionRow({ capacity: 8 })]));
});

test("gymTurnosRowsRevision (calendar key) changes when date/startsAt/endsAt change, previously unfolded", () => {
  const base = [studentSessionRow()];
  const rescheduled = [studentSessionRow({ date: "2030-06-12", startsAt: "2030-06-12T21:00:00.000Z", endsAt: "2030-06-12T22:00:00.000Z" })];
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision(rescheduled));
});

test("gymTurnosRowsRevision (calendar key) changes when activityName changes, previously unfolded", () => {
  const base = [studentSessionRow()];
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision([studentSessionRow({ activityName: "Funcional" })]));
});

test("gymTurnosRowsRevision (calendar key) changes when allowsRecurring/dayOfWeek/slotId change, previously unfolded", () => {
  const base = [studentSessionRow()];
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision([studentSessionRow({ allowsRecurring: false })]));
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision([studentSessionRow({ dayOfWeek: 5 })]));
  assert.notEqual(gymTurnosRowsRevision(base), gymTurnosRowsRevision([studentSessionRow({ slotId: "slot-2" })]));
});

test("gymTurnosMyTurnosRevision composes bookings and enrollments as one structured object under distinct keys", () => {
  const bookings = [{ bookingId: "b-1", activityName: "Spinning", date: "2030-06-05", startsAt: "2030-06-05T21:00:00.000Z", endsAt: "2030-06-05T22:00:00.000Z" }];
  const enrollments = [{ enrollmentId: "e-1", activityName: "Spinning", dayOfWeek: 3, startMinute: 60, endMinute: 120 }];
  const revision = gymTurnosMyTurnosRevision(bookings, enrollments);
  assert.deepEqual(JSON.parse(revision), { bookings, enrollments });
});

test("gymTurnosMyTurnosRevision changes when either group changes", () => {
  const bookings = [{ bookingId: "b-1", activityName: "Spinning", date: "2030-06-05", startsAt: "x", endsAt: "y" }];
  const enrollments = [{ enrollmentId: "e-1", activityName: "Spinning", dayOfWeek: 3, startMinute: 60, endMinute: 120 }];
  const base = gymTurnosMyTurnosRevision(bookings, enrollments);
  assert.notEqual(base, gymTurnosMyTurnosRevision([], enrollments));
  assert.notEqual(base, gymTurnosMyTurnosRevision(bookings, []));
});

test("gymTurnosSlotsRevision changes when active/startMinute/endMinute change", () => {
  const base = [{ id: "slot-1", dayOfWeek: 3, date: null, active: true, startMinute: 60, endMinute: 120, capacity: null }];
  const revision = gymTurnosSlotsRevision(base);
  assert.notEqual(revision, gymTurnosSlotsRevision([{ ...base[0], active: false }]));
  assert.notEqual(revision, gymTurnosSlotsRevision([{ ...base[0], startMinute: 90 }]));
});

test("gymTurnosSlotsRevision changes when dayOfWeek changes, previously unfolded", () => {
  const base = [{ id: "slot-1", dayOfWeek: 3, date: null, active: true, startMinute: 60, endMinute: 120, capacity: null }];
  assert.notEqual(gymTurnosSlotsRevision(base), gymTurnosSlotsRevision([{ ...base[0], dayOfWeek: 4 }]));
});

test("gymTurnosSlotsRevision changes when date changes, previously unfolded", () => {
  const base = [{ id: "slot-2", dayOfWeek: null, date: "2030-06-10", active: true, startMinute: 60, endMinute: 120, capacity: null }];
  assert.notEqual(gymTurnosSlotsRevision(base), gymTurnosSlotsRevision([{ ...base[0], date: "2030-06-11" }]));
});

test("gymTurnosSlotsRevision changes when capacity changes, previously unfolded", () => {
  const base = [{ id: "slot-1", dayOfWeek: 3, date: null, active: true, startMinute: 60, endMinute: 120, capacity: null }];
  assert.notEqual(gymTurnosSlotsRevision(base), gymTurnosSlotsRevision([{ ...base[0], capacity: 5 }]));
});

test("gymTurnosSessionsRevision changes when bookedCount/cancelled change", () => {
  const base = [{ id: "session-1", date: "2030-06-05", startsAt: "2030-06-05T21:00:00.000Z", endsAt: "2030-06-05T22:00:00.000Z", capacity: 3, bookedCount: 1, cancelled: false }];
  const revision = gymTurnosSessionsRevision(base);
  assert.notEqual(revision, gymTurnosSessionsRevision([{ ...base[0], bookedCount: 2 }]));
  assert.notEqual(revision, gymTurnosSessionsRevision([{ ...base[0], cancelled: true }]));
});

test("gymTurnosSessionsRevision changes when date/startsAt/endsAt change, previously unfolded", () => {
  const base = [{ id: "session-1", date: "2030-06-05", startsAt: "2030-06-05T21:00:00.000Z", endsAt: "2030-06-05T22:00:00.000Z", capacity: 3, bookedCount: 1, cancelled: false }];
  const rescheduled = [{ ...base[0], date: "2030-06-12", startsAt: "2030-06-12T21:00:00.000Z", endsAt: "2030-06-12T22:00:00.000Z" }];
  assert.notEqual(gymTurnosSessionsRevision(base), gymTurnosSessionsRevision(rescheduled));
});

test("gymTurnosSessionsRevision changes when capacity changes, previously unfolded", () => {
  const base = [{ id: "session-1", date: "2030-06-05", startsAt: "2030-06-05T21:00:00.000Z", endsAt: "2030-06-05T22:00:00.000Z", capacity: 3, bookedCount: 1, cancelled: false }];
  assert.notEqual(gymTurnosSessionsRevision(base), gymTurnosSessionsRevision([{ ...base[0], capacity: 8 }]));
});

function activityListRow(overrides = {}) {
  return {
    id: "activity-1",
    name: "Spinning",
    description: "Cardio",
    teacherId: null,
    teacherName: null,
    scheduleKind: "WEEKLY",
    allowsRecurring: true,
    cancelWindowHours: 2,
    capacity: 3,
    startsOn: anchor,
    endsOn: null,
    active: true,
    slots: [{ dayOfWeek: 3, date: null, startMinute: 60, endMinute: 120 }],
    ...overrides,
  };
}

test("gymTurnosListRevision changes when id/name/teacherId/active change", () => {
  const base = [activityListRow()];
  const revision = gymTurnosListRevision(base);
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ name: "Renombrada" })]));
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ teacherId: GYM_DEMO_PRIMARY_TEACHER_ID })]));
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ active: false })]));
});

test("gymTurnosListRevision changes when capacity changes, previously unfolded", () => {
  const base = [activityListRow()];
  assert.notEqual(gymTurnosListRevision(base), gymTurnosListRevision([activityListRow({ capacity: 10 })]));
});

test("gymTurnosListRevision changes when description/cancelWindowHours/allowsRecurring/startsOn/endsOn change, previously unfolded", () => {
  const base = [activityListRow()];
  const revision = gymTurnosListRevision(base);
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ description: "Otra descripción" })]));
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ cancelWindowHours: 9 })]));
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ allowsRecurring: false })]));
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ startsOn: "2030-07-01" })]));
  assert.notEqual(revision, gymTurnosListRevision([activityListRow({ endsOn: "2030-08-01" })]));
});

test("gymTurnosListRevision changes when the nested slot schedule summary changes, previously unfolded", () => {
  const base = [activityListRow()];
  const rescheduled = [activityListRow({ slots: [{ dayOfWeek: 4, date: null, startMinute: 60, endMinute: 120 }] })];
  assert.notEqual(gymTurnosListRevision(base), gymTurnosListRevision(rescheduled));
});

test("gymTurnosBookingRevision changes when the bookings or availableStudents change", () => {
  const bookings = [{ bookingId: "b-1", userId: "s-1", name: "Leon", accountKind: "FULL", addedByStaff: false }];
  const available = [{ id: "s-2", name: "Micaela", accountKind: "FULL" }];
  const base = gymTurnosBookingRevision(bookings, available);
  assert.notEqual(base, gymTurnosBookingRevision([], available));
  assert.notEqual(base, gymTurnosBookingRevision(bookings, []));
});

test("gymTurnosBookingRevision changes when addedByStaff changes, previously unfolded", () => {
  const bookings = [{ bookingId: "b-1", userId: "s-1", name: "Leon", accountKind: "FULL", addedByStaff: false }];
  const available = [];
  const before = gymTurnosBookingRevision(bookings, available);
  const after = gymTurnosBookingRevision([{ ...bookings[0], addedByStaff: true }], available);
  assert.notEqual(before, after);
});

test("gymTurnosBookingRevision keeps the two groups distinguishable even when the same data moves between them", () => {
  const asBooking = gymTurnosBookingRevision(
    [{ bookingId: "x", userId: "s-1", name: "Ana", accountKind: "FULL", addedByStaff: false }],
    [],
  );
  const asAvailable = gymTurnosBookingRevision(
    [],
    [{ id: "x", name: "Ana", accountKind: "FULL" }],
  );
  assert.notEqual(asBooking, asAvailable);
});

test("gymTurnosBookingRevision composes both groups as one structured object under distinct keys, not a string join", () => {
  const bookings = [{ bookingId: "b-1", userId: "s-1", name: "Leon", accountKind: "FULL", addedByStaff: false }];
  const available = [{ id: "s-2", name: "Micaela", accountKind: "FULL" }];
  const revision = gymTurnosBookingRevision(bookings, available);
  // A join with a hand-picked separator (e.g. "::") is not valid JSON as a whole and cannot
  // round-trip into the exact {bookings, availableStudents} shape the way a structured object can.
  assert.deepEqual(JSON.parse(revision), { bookings, availableStudents: available });
});

test("selectInitialGymTurnosActor is a no-op with no initialRole", () => {
  const state = baseState();
  assert.equal(selectInitialGymTurnosActor(state, undefined), state);
});

test("selectInitialGymTurnosActor is a no-op when the current actor already has that role", () => {
  const state = baseState();
  assert.equal(activeGymTurnosActor(state).role, "ADMIN");
  assert.equal(selectInitialGymTurnosActor(state, "ADMIN"), state);
});

test("selectInitialGymTurnosActor switches to the first actor with the requested role", () => {
  const state = baseState();
  const next = selectInitialGymTurnosActor(state, "STUDENT");
  assert.equal(activeGymTurnosActor(next).role, "STUDENT");
});

test("selectInitialGymTurnosActor is a no-op when no actor has the requested role", () => {
  const state = baseState();
  const noTeachers = { ...state, actors: state.actors.filter((actor) => actor.role !== "TEACHER") };
  assert.equal(selectInitialGymTurnosActor(noTeachers, "TEACHER"), noTeachers);
});

test("resolveGymTurnosDisplayName returns the override when present and non-blank", () => {
  const overrides = new Map([["s-1", "Nombre Editado"]]);
  assert.equal(resolveGymTurnosDisplayName(overrides, "s-1", "Nombre Canonico"), "Nombre Editado");
});

test("resolveGymTurnosDisplayName falls back to the canonical name when the id is absent from the map", () => {
  const overrides = new Map([["s-1", "Nombre Editado"]]);
  assert.equal(resolveGymTurnosDisplayName(overrides, "s-2", "Nombre Canonico"), "Nombre Canonico");
});

test("resolveGymTurnosDisplayName falls back to the canonical name when the override is blank or whitespace-only", () => {
  const overrides = new Map([["s-1", "   "]]);
  assert.equal(resolveGymTurnosDisplayName(overrides, "s-1", "Nombre Canonico"), "Nombre Canonico");
});

test("applyGymTurnosBookingNameOverrides overlays by userId and re-sorts by the resulting name", () => {
  const rows = [
    { bookingId: "b-1", userId: "s-1", name: "Ana", accountKind: "FULL", addedByStaff: false },
    { bookingId: "b-2", userId: "s-2", name: "Beto", accountKind: "FULL", addedByStaff: false },
  ];
  const overrides = new Map([["s-1", "Zeta"]]);
  const result = applyGymTurnosBookingNameOverrides(rows, overrides);
  assert.deepEqual(result.map((row) => row.name), ["Beto", "Zeta"]);
  assert.deepEqual(result.map((row) => row.bookingId), ["b-2", "b-1"]);
  // Non-name fields are preserved untouched.
  assert.equal(result.find((row) => row.bookingId === "b-1").accountKind, "FULL");
});

test("applyGymTurnosBookingNameOverrides leaves rows unchanged with no matching overrides", () => {
  const rows = [{ bookingId: "b-1", userId: "s-1", name: "Ana", accountKind: "LITE", addedByStaff: true }];
  const result = applyGymTurnosBookingNameOverrides(rows, new Map());
  assert.deepEqual(result, rows);
});

test("applyGymTurnosStudentOptionNameOverrides overlays by id and re-sorts by the resulting name", () => {
  const rows = [
    { id: "s-1", name: "Ana", accountKind: "FULL" },
    { id: "s-2", name: "Beto", accountKind: "FULL" },
  ];
  const overrides = new Map([["s-1", "Zeta"]]);
  const result = applyGymTurnosStudentOptionNameOverrides(rows, overrides);
  assert.deepEqual(result.map((row) => row.name), ["Beto", "Zeta"]);
  assert.deepEqual(result.map((row) => row.id), ["s-2", "s-1"]);
});

test("name overrides never touch identity fields (userId/id stay canonical)", () => {
  const bookingRows = [{ bookingId: "b-1", userId: GYM_DEMO_PERSONALIZED_STUDENT_ID, name: "Irene", accountKind: "FULL", addedByStaff: false }];
  const overridden = applyGymTurnosBookingNameOverrides(bookingRows, new Map([[GYM_DEMO_PERSONALIZED_STUDENT_ID, "Nombre Editado"]]));
  assert.equal(overridden[0].userId, GYM_DEMO_PERSONALIZED_STUDENT_ID);
  assert.equal(overridden[0].name, "Nombre Editado");
});
