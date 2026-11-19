import assert from "node:assert/strict";
import test from "node:test";
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID,
  GYM_DEMO_MUSLIB_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
} from "../scenarios/gym-demo-directory.ts";
import {
  cancelGymTurnosSession,
  createGymTurnosActivity,
  createGymTurnosDemoState,
  deactivateGymTurnosSlot,
  deleteGymTurnosActivity,
  manageGymTurnosSlot,
  manuallyBookGymTurnosStudent,
  manuallyUnbookGymTurnosStudent,
  materializeUpcomingGymTurnosSessions,
  previewGymTurnosActivityDeletion,
  reduceGymTurnosDemo,
  selectGymTurnosDemoActor,
  studentBookGymTurnosSession,
  studentCancelGymTurnosBooking,
  studentCancelGymTurnosEnrollment,
  studentEnrollGymTurnosSlot,
  toAvailableGymTurnosStudentOptions,
  toGymTurnosActivityListRows,
  toGymTurnosEnrollmentBookingRows,
  toGymTurnosMyBookingRows,
  toGymTurnosMyEnrollmentRows,
  toGymTurnosSessionRows,
  toGymTurnosStudentSessionRows,
  updateGymTurnosActivity,
} from "./gym-turnos-demo-state.ts";
import {
  isValidGymTurnosDemoState,
  persistGymTurnosDemoState,
  resolveGymTurnosDemoInitialState,
  serializeGymTurnosDemoState,
} from "./gym-turnos-demo-storage.ts";

const now = new Date("2030-06-03T15:00:00.000Z");
const anchor = "2030-06-03";
const weeklyInput = {
  name: "Pilates",
  description: null,
  teacherId: GYM_DEMO_PRIMARY_TEACHER_ID,
  scheduleKind: "WEEKLY",
  allowsRecurring: true,
  cancelWindowHours: 2,
  capacity: 8,
  startsOn: "2030-06-05",
  endsOn: null,
};
const weeklySlot = {
  dayOfWeek: 3,
  date: null,
  startMinute: 20 * 60,
  endMinute: 21 * 60,
  capacity: null,
};

function fixture() {
  return createGymTurnosDemoState(anchor, now);
}

function session(state, activityId = "activity-spinning") {
  return state.sessions.find((candidate) => candidate.activityId === activityId);
}

function asActor(state, actorId) {
  const selected = selectGymTurnosDemoActor(state, actorId);
  assert.equal(selected.result.success, true);
  return selected.state;
}

test("the GYM turnos roster is drawn from the canonical directory and namespace is isolated from BOX's", () => {
  const state = fixture();
  assert.deepEqual(
    state.actors.map((actor) => actor.id).sort(),
    [
      GYM_DEMO_ADMIN_ID,
      GYM_DEMO_GENERAL_STUDENT_ID,
      GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID,
      GYM_DEMO_PERSONALIZED_STUDENT_ID,
      GYM_DEMO_PRIMARY_TEACHER_ID,
      GYM_DEMO_SECONDARY_TEACHER_ID,
      GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
      "gym-fixed-student-muslib",
    ].sort(),
  );
  assert.equal(state.actors.some((actor) => actor.role === "STUDENT" && actor.accountKind === null), false);
  assert.equal(state.actors.every((actor) => actor.role === "STUDENT" || actor.accountKind === null), true);
});

test("normalized fixture projects the exact management and selected-student view-model cardinalities", () => {
  const state = fixture();
  const spinning = session(state);
  assert.equal(isValidGymTurnosDemoState(state), true);
  assert.equal(toGymTurnosActivityListRows(state)[0].slots[0].dayOfWeek, 3);
  assert.equal(toGymTurnosSessionRows(state, "activity-spinning")[0].bookedCount, 3);
  assert.equal(toGymTurnosEnrollmentBookingRows(state, spinning.id).length, 3);
  assert.equal(
    toAvailableGymTurnosStudentOptions(state, spinning.id).some((student) => student.id === GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID),
    false,
  );

  const studentSessions = toGymTurnosStudentSessionRows(state, GYM_DEMO_GENERAL_STUDENT_ID, now);
  assert.equal(studentSessions.find((row) => row.id === spinning.id).bookingId !== null, true);
  assert.equal(toGymTurnosMyBookingRows(state, GYM_DEMO_GENERAL_STUDENT_ID, now).length >= 1, true);
  assert.deepEqual(toGymTurnosMyEnrollmentRows(state, GYM_DEMO_GENERAL_STUDENT_ID)[0], {
    enrollmentId: "enrollment-spinning-paula",
    activityName: "Spinning",
    dayOfWeek: 3,
    startMinute: 1080,
    endMinute: 1140,
  });
});

test("activity creation validates initial slots and gives a teacher ownership without reassignment privilege", () => {
  let state = fixture();
  assert.strictEqual(createGymTurnosActivity(state, weeklyInput, [], now).state, state);
  assert.match(createGymTurnosActivity(state, weeklyInput, [], now).result.error, /al menos un horario/);
  assert.match(
    createGymTurnosActivity(state, { ...weeklyInput, startsOn: "2030-06-06" }, [weeklySlot], now).result.error,
    /fecha de inicio/,
  );
  const created = createGymTurnosActivity(state, weeklyInput, [weeklySlot], now);
  assert.equal(created.result.success, true);
  state = created.state;
  const activity = created.result.activity;
  assert.equal(state.slots.some((slot) => slot.activityId === activity.id), true);
  assert.equal(state.sessions.some((candidate) => candidate.activityId === activity.id), true);
  const oneOff = createGymTurnosActivity(
    state,
    { ...weeklyInput, name: "Charla nutricional", scheduleKind: "ONE_OFF", allowsRecurring: false, startsOn: null, endsOn: null },
    [{ ...weeklySlot, dayOfWeek: null, date: "2030-06-12" }],
    now,
  );
  assert.equal(oneOff.result.success, true);
  assert.equal(oneOff.state.sessions.some((candidate) => candidate.activityId === oneOff.result.activity.id && candidate.date === "2030-06-12"), true);

  state = asActor(state, GYM_DEMO_PRIMARY_TEACHER_ID);
  const teacherCreated = createGymTurnosActivity(state, { ...weeklyInput, teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, name: "Own class" }, [weeklySlot], now);
  assert.equal(teacherCreated.result.success, true);
  assert.equal(teacherCreated.result.activity.teacherId, GYM_DEMO_PRIMARY_TEACHER_ID);
  assert.match(
    updateGymTurnosActivity(state, "activity-spinning", { ...weeklyInput, teacherId: GYM_DEMO_SECONDARY_TEACHER_ID }, now).result.error,
    /No autorizado/,
  );
  const oldSessionCapacity = session(state).capacity;
  const updated = updateGymTurnosActivity(state, "activity-spinning", { ...weeklyInput, capacity: 99 }, now);
  assert.equal(updated.result.success, true);
  assert.equal(session(updated.state).capacity, oldSessionCapacity, "default capacity never rewrites a snapshot");
});

test("turning off allowsRecurring while an enrollment exists is rejected, keeping the state serializable and persistable", () => {
  const state = fixture();
  const spinning = state.activities.find((activity) => activity.id === "activity-spinning");
  assert.equal(state.enrollments.some((enrollment) => enrollment.slotId === "slot-spinning-wed"), true, "the fixture must already have an enrollment on this activity's slot");
  const input = {
    name: spinning.name,
    description: spinning.description,
    teacherId: spinning.teacherId,
    scheduleKind: spinning.scheduleKind,
    allowsRecurring: false,
    cancelWindowHours: spinning.cancelWindowHours,
    capacity: spinning.capacity,
    startsOn: spinning.startsOn,
    endsOn: spinning.endsOn,
  };
  const updated = updateGymTurnosActivity(state, "activity-spinning", input, now);
  assert.equal(updated.result.success, false);
  assert.match(updated.result.error, /inscripción recurrente/);
  assert.strictEqual(updated.state, state, "a rejected edit must never mutate the graph");

  // This is the assertion that would have caught the real bug: before the guard, the command
  // above returned success:true with a state whose enrollment now pointed at a non-recurring
  // activity — a shape isValidGymTurnosDemoState always rejects, and serialize/persist would
  // have thrown or warned on the very next save despite the command reporting success.
  assert.equal(isValidGymTurnosDemoState(updated.state), true);
  assert.doesNotThrow(() => serializeGymTurnosDemoState(updated.state));
  const storage = { getItem: () => null, setItem: () => {} };
  assert.equal(persistGymTurnosDemoState(storage, updated.state), null);

  // An activity with no enrollment on any of its slots may still turn allowsRecurring off.
  const funcionalInput = {
    name: "Funcional",
    description: null,
    teacherId: GYM_DEMO_SECONDARY_TEACHER_ID,
    scheduleKind: "WEEKLY",
    allowsRecurring: false,
    cancelWindowHours: 2,
    capacity: 8,
    startsOn: state.activities.find((activity) => activity.id === "activity-funcional").startsOn,
    endsOn: null,
  };
  const funcionalUpdated = updateGymTurnosActivity(state, "activity-funcional", funcionalInput, now);
  assert.equal(funcionalUpdated.result.success, true);
});

test("slot create, edit, and deactivate enforce local overlap, validity, and ownership", () => {
  let state = fixture();
  assert.match(
    manageGymTurnosSlot(state, "activity-spinning", { ...weeklySlot, startMinute: 1100, endMinute: 1200 }).result.error,
    /superpuestos/,
  );
  const added = manageGymTurnosSlot(state, "activity-spinning", weeklySlot);
  assert.equal(added.result.success, true);
  state = added.state;
  const slotId = added.result.slot.id;
  const edited = manageGymTurnosSlot(state, "activity-spinning", { ...weeklySlot, startMinute: 21 * 60, endMinute: 22 * 60 }, slotId);
  assert.equal(edited.result.success, true);
  state = edited.state;
  assert.match(
    manageGymTurnosSlot(state, "activity-spinning", { ...weeklySlot, dayOfWeek: null }, slotId).result.error,
    /día de la semana/,
  );
  state = asActor(state, GYM_DEMO_SECONDARY_TEACHER_ID);
  assert.match(deactivateGymTurnosSlot(state, "activity-spinning", slotId).result.error, /No autorizado/);
  state = asActor(state, GYM_DEMO_PRIMARY_TEACHER_ID);
  const deactivated = deactivateGymTurnosSlot(state, "activity-spinning", slotId);
  assert.equal(deactivated.result.success, true);
  assert.equal(deactivated.state.slots.find((slot) => slot.id === slotId).active, false);
});

test("creating a slot immediately materializes its bounded upcoming sessions without changing edits", () => {
  const state = fixture();
  const rejected = reduceGymTurnosDemo(
    state,
    {
      type: "create-slot",
      activityId: "activity-spinning",
      input: { dayOfWeek: 3, date: null, startMinute: 1100, endMinute: 1200, capacity: null },
    },
    now,
  );
  assert.strictEqual(rejected.state, state, "a rejected create leaves the graph untouched");
  assert.equal(rejected.result.success, false);

  const created = reduceGymTurnosDemo(
    state,
    {
      type: "create-slot",
      activityId: "activity-spinning",
      input: { dayOfWeek: 6, date: null, startMinute: 20 * 60, endMinute: 21 * 60, capacity: 4 },
    },
    now,
  );
  assert.equal(created.result.success, true);
  assert.equal("slot" in created.result, true);
  const slotId = created.result.slot.id;
  assert.equal(created.state.sessions.filter((candidate) => candidate.slotId === slotId).length, 4);

  const edited = reduceGymTurnosDemo(
    created.state,
    {
      type: "update-slot",
      activityId: "activity-spinning",
      slotId,
      input: { dayOfWeek: 6, date: null, startMinute: 21 * 60, endMinute: 22 * 60, capacity: 8 },
    },
    now,
  );
  assert.equal(edited.result.success, true);
  assert.equal(edited.state.sessions.filter((candidate) => candidate.slotId === slotId)[0].capacity, 4);
});

test("slot edits persist snapshots while future materialization uses the new slot schedule", () => {
  const state = fixture();
  const originalSession = state.sessions.find((candidate) => candidate.slotId === "slot-spinning-wed");
  const originalSnapshot = {
    date: originalSession.date,
    startsAt: originalSession.startsAt,
    endsAt: originalSession.endsAt,
    capacity: originalSession.capacity,
  };
  const edited = reduceGymTurnosDemo(
    state,
    {
      type: "update-slot",
      activityId: "activity-spinning",
      slotId: "slot-spinning-wed",
      input: { dayOfWeek: 3, date: null, startMinute: 17 * 60, endMinute: 18 * 60, capacity: null },
    },
    now,
  );
  assert.equal(edited.result.success, true);
  assert.deepEqual(
    edited.state.sessions.find((candidate) => candidate.id === originalSession.id),
    { ...originalSession, ...originalSnapshot },
  );
  const restored = resolveGymTurnosDemoInitialState(serializeGymTurnosDemoState(edited.state), "2031-01-01").state;
  assert.equal(restored.slots.find((slot) => slot.id === "slot-spinning-wed").startMinute, 17 * 60);
  assert.deepEqual(
    restored.sessions.find((candidate) => candidate.id === originalSession.id),
    { ...originalSession, ...originalSnapshot },
  );
  const future = materializeUpcomingGymTurnosSessions(restored, new Date("2030-07-01T15:00:00.000Z"));
  const newSession = future.state.sessions.find((candidate) => candidate.slotId === "slot-spinning-wed" && candidate.date === "2030-07-03");
  assert.equal(newSession.startsAt, "2030-07-03T20:00:00.000Z");

  const oneOff = reduceGymTurnosDemo(
    restored,
    {
      type: "update-slot",
      activityId: "activity-musculacion-libre",
      slotId: "slot-musculacion-libre-once",
      input: { dayOfWeek: null, date: "2030-06-12", startMinute: 19 * 60, endMinute: 20 * 60, capacity: null },
    },
    now,
  );
  assert.equal(oneOff.result.success, true);
  assert.equal(
    resolveGymTurnosDemoInitialState(serializeGymTurnosDemoState(oneOff.state), "2031-01-01").state.slots.find((slot) => slot.id === "slot-musculacion-libre-once").date,
    "2030-06-12",
  );
});

test("materialization is idempotent, bounded to four weeks, and uses safe Buenos Aires rollover", () => {
  let state = fixture();
  state = { ...state, sessions: [], bookings: [], enrollments: [] };
  const materialized = materializeUpcomingGymTurnosSessions(state, now);
  assert.equal(materialized.result.sessionsCreated > 0, true);
  assert.equal(materialized.state.sessions.every((candidate) => candidate.date >= "2030-06-03" && candidate.date < "2030-07-01"), true);
  const repeat = materializeUpcomingGymTurnosSessions(materialized.state, now);
  assert.equal(repeat.result.sessionsCreated, 0);
  const late = materialized.state.sessions.find((candidate) => candidate.slotId === "slot-musculacion-libre-once");
  assert.match(late.startsAt, /T02:30:00\.000Z$/);
  assert.match(late.endsAt, /T03:00:00\.000Z$/);
});

test("staff session cancellation immediately cancels every confirmed normalized booking", () => {
  const state = fixture();
  const target = session(state);
  const cancelled = cancelGymTurnosSession(state, target.id, now);
  assert.equal(cancelled.result.success, true);
  assert.equal(cancelled.state.sessions.find((candidate) => candidate.id === target.id).cancelled, true);
  assert.equal(toGymTurnosSessionRows(cancelled.state, "activity-spinning")[0].bookedCount, 0);
  assert.equal(cancelled.state.bookings.filter((booking) => booking.sessionId === target.id).every((booking) => booking.status === "CANCELLED"), true);
  assert.match(cancelGymTurnosSession(cancelled.state, target.id, now).result.error, /ya está cancelada/);
  assert.match(cancelGymTurnosSession(asActor(state, GYM_DEMO_SECONDARY_TEACHER_ID), target.id, now).result.error, /No autorizado/);
});

test("staff can book LITE, rejects duplicate/full/past/cancelled cases, and can unbook", () => {
  let state = fixture();
  const funcional = session(state, "activity-funcional");
  const booked = manuallyBookGymTurnosStudent(state, funcional.id, GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, now);
  assert.equal(booked.result.success, true);
  state = booked.state;
  assert.equal(toGymTurnosEnrollmentBookingRows(state, funcional.id)[0].accountKind, "LITE");
  assert.match(manuallyBookGymTurnosStudent(state, funcional.id, GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, now).result.error, /ya está anotado/);
  const unbooked = manuallyUnbookGymTurnosStudent(state, booked.result.bookingId, now);
  assert.equal(unbooked.result.success, true);
  assert.equal(toGymTurnosSessionRows(unbooked.state, "activity-funcional")[0].bookedCount, 0);

  const full = session(state);
  assert.match(manuallyBookGymTurnosStudent(state, full.id, GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, now).result.error, /No hay cupo/);
  const pastState = { ...state, sessions: state.sessions.map((candidate) => candidate.id === funcional.id ? { ...candidate, startsAt: "2030-06-01T22:00:00.000Z" } : candidate) };
  assert.match(manuallyBookGymTurnosStudent(pastState, funcional.id, GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, now).result.error, /sesión pasada/);
  const cancelled = cancelGymTurnosSession(state, funcional.id, now).state;
  assert.match(manuallyBookGymTurnosStudent(cancelled, funcional.id, GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, now).result.error, /cancelada/);
});

test("FULL students act only for themselves while LITE remains staff-only", () => {
  let state = asActor(fixture(), GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID);
  const funcional = session(state, "activity-funcional");
  assert.match(studentBookGymTurnosSession(state, GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, funcional.id, now).result.error, /no puede reservar/);
  state = asActor(state, GYM_DEMO_GENERAL_STUDENT_ID);
  assert.match(studentBookGymTurnosSession(state, GYM_DEMO_PERSONALIZED_STUDENT_ID, funcional.id, now).result.error, /no puede reservar/);
  const booked = studentBookGymTurnosSession(state, GYM_DEMO_GENERAL_STUDENT_ID, funcional.id, now);
  assert.equal(booked.result.success, true);
  assert.equal(booked.result.bookingId !== undefined, true);
  assert.match(studentBookGymTurnosSession(booked.state, GYM_DEMO_GENERAL_STUDENT_ID, funcional.id, now).result.error, /Ya estás anotado/);
});

test("recurring enrollment keeps an occurrence cancellation and ending it removes only future derived bookings", () => {
  let state = asActor(fixture(), GYM_DEMO_PERSONALIZED_STUDENT_ID);
  const enrolled = studentEnrollGymTurnosSlot(state, GYM_DEMO_PERSONALIZED_STUDENT_ID, "slot-spinning-wed", now);
  assert.equal(enrolled.result.success, true);
  state = enrolled.state;
  const derived = state.bookings.find((booking) => booking.enrollmentId === enrolled.result.enrollmentId && booking.status === "CONFIRMED");
  assert.equal(derived.source, "ENROLLMENT", "a runtime-materialized enrollment booking must carry its own source, distinct from a SINGLE booking");
  const cancelledOccurrence = studentCancelGymTurnosBooking(state, GYM_DEMO_PERSONALIZED_STUDENT_ID, derived.id, now);
  assert.equal(cancelledOccurrence.result.success, true);
  assert.equal(cancelledOccurrence.state.enrollments.find((enrollment) => enrollment.id === enrolled.result.enrollmentId).status, "ACTIVE");

  const withHistory = {
    ...cancelledOccurrence.state,
    sessions: cancelledOccurrence.state.sessions.map((candidate) => candidate.id === derived.sessionId ? { ...candidate, startsAt: "2030-06-01T21:00:00.000Z" } : candidate),
  };
  const ended = studentCancelGymTurnosEnrollment(withHistory, GYM_DEMO_PERSONALIZED_STUDENT_ID, enrolled.result.enrollmentId, now);
  assert.equal(ended.result.success, true);
  assert.equal(ended.state.bookings.find((booking) => booking.id === derived.id).status, "CANCELLED", "occurrence remains historical cancellation");
  assert.equal(ended.state.bookings.filter((booking) => booking.enrollmentId === enrolled.result.enrollmentId && booking.status === "CONFIRMED").length, 0);
  assert.match(studentCancelGymTurnosEnrollment(ended.state, GYM_DEMO_PERSONALIZED_STUDENT_ID, enrolled.result.enrollmentId, now).result.error, /ya estaba cancelada/);
});

test("student cancellation honors the window and preserves the enrollment source relation", () => {
  let state = asActor(fixture(), GYM_DEMO_GENERAL_STUDENT_ID);
  const booking = state.bookings.find((candidate) => candidate.studentId === GYM_DEMO_GENERAL_STUDENT_ID && candidate.source === "SINGLE");
  const target = state.sessions.find((candidate) => candidate.id === booking.sessionId);
  const late = new Date(new Date(target.startsAt).getTime() - 60 * 60 * 1000);
  assert.match(studentCancelGymTurnosBooking(state, GYM_DEMO_GENERAL_STUDENT_ID, booking.id, late).result.error, /al menos 4hs/);
  const early = studentCancelGymTurnosBooking(state, GYM_DEMO_GENERAL_STUDENT_ID, booking.id, now);
  assert.equal(early.result.success, true);
  assert.equal(early.state.enrollments.find((enrollment) => enrollment.id === "enrollment-spinning-paula").status, "ACTIVE");
});

test("deletion preview deletes unused graphs and archives booked history without hard deletion", () => {
  let state = fixture();
  const created = createGymTurnosActivity(state, weeklyInput, [weeklySlot], now);
  state = created.state;
  const unusedId = created.result.activity.id;
  const previewUnused = previewGymTurnosActivityDeletion(state, unusedId, now);
  assert.deepEqual(previewUnused.result, { success: true, willArchive: false, futureBookedStudents: 0 });
  const deleted = deleteGymTurnosActivity(state, unusedId, now);
  assert.equal(deleted.result.mode, "deleted");
  assert.equal(deleted.state.activities.some((activity) => activity.id === unusedId), false);

  const previewBooked = previewGymTurnosActivityDeletion(state, "activity-spinning", now);
  assert.equal(previewBooked.result.willArchive, true);
  const archived = deleteGymTurnosActivity(state, "activity-spinning", now);
  assert.equal(archived.result.mode, "archived");
  assert.equal(archived.state.activities.find((activity) => activity.id === "activity-spinning").active, false);
  assert.equal(archived.state.bookings.some((booking) => booking.id === "booking-spinning-paula-first"), true);
});

test("student projections hide inactive schedules while retaining the production-equivalent booking history", () => {
  let state = fixture();
  const added = reduceGymTurnosDemo(
    state,
    {
      type: "create-slot",
      activityId: "activity-spinning",
      input: { dayOfWeek: 3, date: null, startMinute: 20 * 60, endMinute: 21 * 60, capacity: null },
    },
    now,
  );
  assert.equal(added.result.success, true);
  state = deactivateGymTurnosSlot(added.state, "activity-spinning", "slot-spinning-wed").state;
  assert.equal(toGymTurnosStudentSessionRows(state, GYM_DEMO_GENERAL_STUDENT_ID, now).some((row) => row.slotId === "slot-spinning-wed"), false);
  assert.equal(toGymTurnosMyBookingRows(state, GYM_DEMO_GENERAL_STUDENT_ID, now).some((row) => row.bookingId === "booking-spinning-paula-first"), true);
  assert.equal(toGymTurnosMyEnrollmentRows(state, GYM_DEMO_GENERAL_STUDENT_ID).some((row) => row.enrollmentId === "enrollment-spinning-paula"), true);

  const archived = deleteGymTurnosActivity(state, "activity-spinning", now).state;
  assert.equal(toGymTurnosStudentSessionRows(archived, GYM_DEMO_GENERAL_STUDENT_ID, now).some((row) => row.activityName === "Spinning"), false);
  assert.equal(toGymTurnosMyBookingRows(archived, GYM_DEMO_GENERAL_STUDENT_ID, now).some((row) => row.activityName === "Spinning"), false);
  assert.equal(archived.bookings.some((booking) => booking.id === "booking-spinning-paula-first" && booking.status === "CANCELLED"), true);
  assert.equal(toGymTurnosMyEnrollmentRows(archived, GYM_DEMO_GENERAL_STUDENT_ID).some((row) => row.enrollmentId === "enrollment-spinning-paula"), true);
});

test("command reducer returns callback-shaped transitions for adapters", () => {
  const state = fixture();
  const selected = reduceGymTurnosDemo(state, { type: "select-actor", actorId: GYM_DEMO_GENERAL_STUDENT_ID }, now);
  assert.deepEqual(selected.result, { success: true });
  const booked = reduceGymTurnosDemo(selected.state, { type: "student-book", studentId: GYM_DEMO_GENERAL_STUDENT_ID, sessionId: session(selected.state, "activity-funcional").id }, now);
  assert.equal(booked.result.success, true);
  assert.equal("bookingId" in booked.result, true);
});

test("versioned restore rejects malformed nested data, relations, capacity semantics, and unknown versions", () => {
  const state = fixture();
  const raw = serializeGymTurnosDemoState(state);
  assert.equal(resolveGymTurnosDemoInitialState(raw, "2031-01-01").state.anchorDate, anchor);
  // Each case below mutates exactly one row of its collection with the rest of the graph left
  // intact, so it fails on the specific check it is named for rather than on an unrelated dangling
  // reference produced by discarding sibling rows. Replacing a whole collection with a single
  // mutated element (e.g. `activities: [{ ...state.activities[0], ... }]`) would silently drop the
  // other activities/sessions/etc. that slots/sessions/bookings elsewhere in the fixture still
  // point at, so the validator could reject for that unrelated reason before ever reaching the
  // named check — confirmed by mutation-testing each case against both shapes (see review notes).
  const malformed = [
    { ...state, version: 999 },
    { ...state, actors: [{ id: "bad", name: "Bad", role: "STUDENT", accountKind: "BROKEN" }] },
    {
      ...state,
      activities: state.activities.map((activity) =>
        activity.id === "activity-spinning" ? { ...activity, startsOn: "2030-02-30" } : activity,
      ),
    },
    { ...state, slots: [{ ...state.slots[0], activityId: "missing" }] },
    {
      ...state,
      sessions: state.sessions.map((session) =>
        session.id === state.sessions[0].id ? { ...session, slotId: "slot-funcional-fri" } : session,
      ),
    },
    { ...state, bookings: [{ ...state.bookings[0], studentId: "missing" }] },
    {
      // The enrollment's own bookings (source: "ENROLLMENT") are derived from — and only valid
      // relative to — its own slotId, so they are removed here rather than left to dangle: this
      // isolates the enrollment's own WEEKLY/allowsRecurring eligibility check from the unrelated
      // bookings-section cross-check (`enrollment.slotId === session.slotId`), which would
      // otherwise also reject these now-inconsistent derived bookings and mask which check fired.
      ...state,
      enrollments: state.enrollments.map((enrollment) =>
        enrollment.id === "enrollment-spinning-paula" ? { ...enrollment, slotId: "slot-funcional-fri" } : enrollment,
      ),
      bookings: state.bookings.filter((booking) => booking.enrollmentId === null),
    },
    { ...state, bookings: [...state.bookings, { ...state.bookings[0], id: "duplicate" }] },
    {
      ...state,
      sessions: state.sessions.map((session) =>
        session.id === state.sessions[0].id ? { ...session, capacity: 1 } : session,
      ),
    },
    {
      ...state,
      sessions: state.sessions.map((session) =>
        session.id === state.sessions[0].id ? { ...session, date: "2030-06-06" } : session,
      ),
    },
    { ...state, actors: state.actors.map((actor) => actor.id === GYM_DEMO_ADMIN_ID ? { ...actor, extra: true } : actor) },
  ];
  for (const candidate of malformed) {
    assert.equal(isValidGymTurnosDemoState(candidate), false);
    assert.equal(resolveGymTurnosDemoInitialState(JSON.stringify(candidate), "2031-01-01").state.anchorDate, "2031-01-01");
  }
  assert.equal(resolveGymTurnosDemoInitialState("not-json", "2031-01-01").state.anchorDate, "2031-01-01");
});

test("versioned restore rejects duplicate occurrences and invalid active weekly slot invariants", () => {
  const state = fixture();
  const firstSession = state.sessions[0];
  const malformed = [
    {
      ...state,
      sessions: [...state.sessions, { ...firstSession, id: "session-duplicate-occurrence" }],
    },
    {
      ...state,
      slots: [
        ...state.slots,
        {
          ...state.slots.find((slot) => slot.id === "slot-spinning-wed"),
          id: "slot-spinning-overlap",
          startMinute: 1100,
          endMinute: 1200,
        },
      ],
    },
    {
      ...state,
      slots: state.slots.map((slot) =>
        slot.id === "slot-spinning-wed" ? { ...slot, active: false } : slot,
      ),
    },
    {
      ...state,
      slots: [
        ...state.slots.map((slot) =>
          slot.activityId === "activity-spinning" ? { ...slot, active: false } : slot,
        ),
        {
          id: "slot-spinning-friday",
          activityId: "activity-spinning",
          dayOfWeek: 5,
          date: null,
          startMinute: 20 * 60,
          endMinute: 21 * 60,
          capacity: null,
          active: true,
        },
      ],
    },
  ];
  for (const candidate of malformed) {
    assert.equal(isValidGymTurnosDemoState(candidate), false);
    assert.equal(resolveGymTurnosDemoInitialState(JSON.stringify(candidate), "2031-01-01").state.anchorDate, "2031-01-01");
  }

  const inactiveHistorical = {
    ...state,
    activities: state.activities.map((activity) =>
      activity.id === "activity-spinning" ? { ...activity, active: false } : activity,
    ),
    slots: state.slots.map((slot) =>
      slot.activityId === "activity-spinning" ? { ...slot, active: false } : slot,
    ),
    sessions: state.sessions.map((candidate) =>
      candidate.id === firstSession.id ? { ...candidate, cancelled: true } : candidate,
    ),
    bookings: state.bookings.map((booking) =>
      booking.sessionId === firstSession.id && booking.status === "CONFIRMED"
        ? { ...booking, status: "CANCELLED", cancelledAt: now.toISOString() }
        : booking,
    ),
  };
  assert.equal(isValidGymTurnosDemoState(inactiveHistorical), true);
  assert.equal(resolveGymTurnosDemoInitialState(JSON.stringify(inactiveHistorical), "2031-01-01").state.anchorDate, anchor);
});

test("no reachable command ever cancels an enrollment as a side effect of cancelling one of its bookings", () => {
  let state = asActor(fixture(), GYM_DEMO_PERSONALIZED_STUDENT_ID);
  const enrolled = studentEnrollGymTurnosSlot(state, GYM_DEMO_PERSONALIZED_STUDENT_ID, "slot-spinning-wed", now);
  assert.equal(enrolled.result.success, true);
  state = asActor(enrolled.state, GYM_DEMO_ADMIN_ID);
  const derived = state.bookings.find((booking) => booking.enrollmentId === enrolled.result.enrollmentId && booking.status === "CONFIRMED");
  const staffUnbooked = manuallyUnbookGymTurnosStudent(state, derived.id, now);
  assert.equal(staffUnbooked.result.success, true);
  assert.equal(staffUnbooked.state.enrollments.find((enrollment) => enrollment.id === enrolled.result.enrollmentId).status, "ACTIVE");
});

test("a materialized booking always carries its own row distinct from the enrollment that produced it", () => {
  const state = fixture();
  const enrollmentBookings = state.bookings.filter((booking) => booking.enrollmentId === "enrollment-spinning-paula");
  assert.equal(enrollmentBookings.length >= 1, true);
  for (const booking of enrollmentBookings) {
    assert.notEqual(booking.id, "enrollment-spinning-paula");
    assert.equal(booking.source, "ENROLLMENT");
  }
  const singleBooking = state.bookings.find((booking) => booking.id === "booking-spinning-paula-first");
  assert.equal(singleBooking.source, "SINGLE");
  assert.equal(singleBooking.enrollmentId, null);
});

test("re-enrolling a slot after cancelling the whole enrollment revives every confirmed booking the first enrollment created", () => {
  let state = asActor(fixture(), GYM_DEMO_MUSLIB_STUDENT_ID);
  const firstEnroll = studentEnrollGymTurnosSlot(state, GYM_DEMO_MUSLIB_STUDENT_ID, "slot-spinning-wed", now);
  assert.equal(firstEnroll.result.success, true);
  assert.equal(firstEnroll.result.bookingsCreated, 3);
  state = firstEnroll.state;
  const firstConfirmed = state.bookings.filter(
    (booking) => booking.enrollmentId === firstEnroll.result.enrollmentId && booking.status === "CONFIRMED",
  );
  assert.equal(firstConfirmed.length, 3);

  const ended = studentCancelGymTurnosEnrollment(state, GYM_DEMO_MUSLIB_STUDENT_ID, firstEnroll.result.enrollmentId, now);
  assert.equal(ended.result.success, true);
  assert.equal(
    ended.state.bookings.filter((booking) => booking.enrollmentId === firstEnroll.result.enrollmentId && booking.status === "CONFIRMED").length,
    0,
  );

  const reEnroll = studentEnrollGymTurnosSlot(ended.state, GYM_DEMO_MUSLIB_STUDENT_ID, "slot-spinning-wed", now);
  assert.equal(reEnroll.result.success, true);
  assert.equal(reEnroll.result.enrollmentId, firstEnroll.result.enrollmentId);
  assert.equal(reEnroll.result.bookingsCreated, 3, "re-enrolling must revive every previously cancelled occurrence, not just create net-new ones");
  const revivedConfirmed = reEnroll.state.bookings.filter(
    (booking) => booking.enrollmentId === firstEnroll.result.enrollmentId && booking.status === "CONFIRMED",
  );
  assert.equal(revivedConfirmed.length, 3);
  assert.deepEqual(
    revivedConfirmed.map((booking) => booking.sessionId).sort(),
    firstConfirmed.map((booking) => booking.sessionId).sort(),
  );
  assert.equal(reEnroll.state.enrollments.find((enrollment) => enrollment.id === firstEnroll.result.enrollmentId).status, "ACTIVE");
});

test("cancelling one enrollment occurrence survives a rolling-window re-materialization", () => {
  // A slot created through the command (rather than the seeded fixture) gets its session ids from
  // the same `session-${slot.id}-${date}` scheme the window materializer itself uses, so removing
  // and re-adding one of its sessions below reproduces exactly what a rolling window does.
  const created = createGymTurnosActivity(fixture(), weeklyInput, [weeklySlot], now);
  assert.equal(created.result.success, true);
  const slotId = created.state.slots.find((slot) => slot.activityId === created.result.activity.id).id;
  let state = asActor(created.state, GYM_DEMO_MUSLIB_STUDENT_ID);
  const enrolled = studentEnrollGymTurnosSlot(state, GYM_DEMO_MUSLIB_STUDENT_ID, slotId, now);
  assert.equal(enrolled.result.success, true);
  state = enrolled.state;
  const muslibBooking = state.bookings.find(
    (booking) => booking.enrollmentId === enrolled.result.enrollmentId && booking.status === "CONFIRMED",
  );
  const cancelled = studentCancelGymTurnosBooking(state, GYM_DEMO_MUSLIB_STUDENT_ID, muslibBooking.id, now);
  assert.equal(cancelled.result.success, true);
  state = cancelled.state;
  assert.equal(state.bookings.find((booking) => booking.id === muslibBooking.id).status, "CANCELLED");

  // Simulate this occurrence not yet being re-materialized (as if the rolling window had not
  // reached it again), while its cancelled booking row already exists — exactly the shape the
  // real window materializer must not silently revive.
  const withoutSession = { ...state, sessions: state.sessions.filter((session) => session.id !== muslibBooking.sessionId) };
  const remade = materializeUpcomingGymTurnosSessions(withoutSession, now);
  assert.equal(remade.result.success, true);
  assert.equal(remade.state.sessions.some((session) => session.id === muslibBooking.sessionId), true, "the session must be rematerialized");
  assert.equal(
    remade.state.bookings.find((booking) => booking.id === muslibBooking.id).status,
    "CANCELLED",
    "the rolling window must never revive a booking the student deliberately cancelled",
  );
  assert.equal(
    remade.state.bookings.filter(
      (booking) => booking.sessionId === muslibBooking.sessionId && booking.studentId === GYM_DEMO_MUSLIB_STUDENT_ID,
    ).length,
    1,
    "no duplicate booking row must be created for this session/student pair",
  );
});

test("reviving a cancelled enrollment booking on re-enroll still respects session capacity", () => {
  let state = asActor(fixture(), GYM_DEMO_MUSLIB_STUDENT_ID);
  const enrolled = studentEnrollGymTurnosSlot(state, GYM_DEMO_MUSLIB_STUDENT_ID, "slot-spinning-wed", now);
  assert.equal(enrolled.result.success, true);
  assert.equal(enrolled.result.bookingsCreated, 3);
  state = enrolled.state;

  const ended = studentCancelGymTurnosEnrollment(state, GYM_DEMO_MUSLIB_STUDENT_ID, enrolled.result.enrollmentId, now);
  assert.equal(ended.result.success, true);
  state = ended.state;

  // Fill one of muslib's three now-cancelled sessions back up to capacity (3) with two staff-booked
  // students, on top of Paula's still-CONFIRMED enrollment booking there.
  const fullSessionId = state.bookings.find(
    (booking) => booking.enrollmentId === "enrollment-spinning-paula" && booking.status === "CONFIRMED",
  ).sessionId;
  let staffState = asActor(state, GYM_DEMO_ADMIN_ID);
  staffState = manuallyBookGymTurnosStudent(staffState, fullSessionId, GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, now).state;
  staffState = manuallyBookGymTurnosStudent(staffState, fullSessionId, GYM_DEMO_PERSONALIZED_STUDENT_ID, now).state;
  assert.equal(toGymTurnosSessionRows(staffState, "activity-spinning").find((row) => row.id === fullSessionId).bookedCount, 3);

  const reEnrollState = asActor(staffState, GYM_DEMO_MUSLIB_STUDENT_ID);
  const reEnrolled = studentEnrollGymTurnosSlot(reEnrollState, GYM_DEMO_MUSLIB_STUDENT_ID, "slot-spinning-wed", now);
  assert.equal(reEnrolled.result.success, true);
  assert.equal(reEnrolled.result.bookingsCreated, 2, "the full session must refuse the revive; the other two occurrences still revive");
  const muslibBookingOnFullSession = reEnrolled.state.bookings.find(
    (booking) => booking.sessionId === fullSessionId && booking.studentId === GYM_DEMO_MUSLIB_STUDENT_ID,
  );
  assert.equal(muslibBookingOnFullSession.status, "CANCELLED", "the capacity guard must keep the revive refused");
});

test("one student enrolling in a slot must not revive another student's deliberately cancelled occurrence on the same slot", () => {
  let state = asActor(fixture(), GYM_DEMO_GENERAL_STUDENT_ID);
  const paulaBooking = state.bookings.find(
    (booking) => booking.enrollmentId === "enrollment-spinning-paula" && booking.status === "CONFIRMED",
  );
  const cancelled = studentCancelGymTurnosBooking(state, GYM_DEMO_GENERAL_STUDENT_ID, paulaBooking.id, now);
  assert.equal(cancelled.result.success, true);
  state = cancelled.state;
  assert.equal(state.bookings.find((booking) => booking.id === paulaBooking.id).status, "CANCELLED");
  const paulaConfirmedBefore = state.bookings.filter(
    (booking) => booking.studentId === GYM_DEMO_GENERAL_STUDENT_ID && booking.status === "CONFIRMED",
  ).length;

  const enrollState = asActor(state, GYM_DEMO_MUSLIB_STUDENT_ID);
  const enrolled = studentEnrollGymTurnosSlot(enrollState, GYM_DEMO_MUSLIB_STUDENT_ID, "slot-spinning-wed", now);
  assert.equal(enrolled.result.success, true);

  assert.equal(
    enrolled.state.bookings.find((booking) => booking.id === paulaBooking.id).status,
    "CANCELLED",
    "another student's enrollment must never revive Paula's deliberately cancelled occurrence",
  );
  assert.equal(
    enrolled.state.bookings.filter(
      (booking) => booking.studentId === GYM_DEMO_GENERAL_STUDENT_ID && booking.status === "CONFIRMED",
    ).length,
    paulaConfirmedBefore,
    "Paula's confirmed count must be unchanged by another student's enrollment",
  );
});
