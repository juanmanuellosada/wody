import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelManagedSession,
  createManagedActivity,
  createManagementDemoState,
  deactivateManagedSlot,
  deleteManagedActivity,
  manageSlot,
  manuallyBookStudent,
  manuallyUnbookStudent,
  materializeUpcomingSessions,
  previewManagedActivityDeletion,
  reduceManagementDemo,
  selectManagementDemoActor,
  studentBookSession,
  studentCancelBooking,
  studentCancelEnrollment,
  studentEnrollInSlot,
  toActivityListRows,
  toAvailableStudentOptions,
  toEnrollmentBookingRows,
  toManagedSessionRows,
  toMyBookingRows,
  toMyEnrollmentRows,
  toStudentSessionRows,
  updateManagedActivity,
} from "./management-demo-state.ts";
import {
  isValidManagementDemoState,
  restoreManagementDemoState,
  serializeManagementDemoState,
} from "./management-demo-storage.ts";

const now = new Date("2030-06-03T15:00:00.000Z");
const anchor = "2030-06-03";
const weeklyInput = {
  name: "Haltera",
  description: null,
  teacherId: "teacher-demo",
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
  return createManagementDemoState(anchor, now);
}

function session(state, activityId = "activity-strength") {
  return state.sessions.find((candidate) => candidate.activityId === activityId);
}

function asActor(state, actorId) {
  const selected = selectManagementDemoActor(state, actorId);
  assert.equal(selected.result.success, true);
  return selected.state;
}

test("normalized fixture projects the exact management and selected-student view-model cardinalities", () => {
  const state = fixture();
  const strength = session(state);
  assert.equal(isValidManagementDemoState(state), true);
  assert.equal(toActivityListRows(state)[0].slots[0].dayOfWeek, 3);
  assert.equal(toManagedSessionRows(state, "activity-strength")[0].bookedCount, 3);
  assert.equal(toEnrollmentBookingRows(state, strength.id).length, 3);
  assert.equal(toAvailableStudentOptions(state, strength.id).some((student) => student.id === "student-lite"), false);

  const studentSessions = toStudentSessionRows(state, "student-full", now);
  assert.equal(studentSessions.find((row) => row.id === strength.id).bookingId !== null, true);
  assert.equal(toMyBookingRows(state, "student-full", now).length >= 1, true);
  assert.deepEqual(toMyEnrollmentRows(state, "student-full")[0], {
    enrollmentId: "enrollment-strength-julia",
    activityName: "Fuerza",
    dayOfWeek: 3,
    startMinute: 1080,
    endMinute: 1140,
  });
});

test("activity creation validates initial slots and gives a teacher ownership without reassignment privilege", () => {
  let state = fixture();
  assert.strictEqual(createManagedActivity(state, weeklyInput, [], now).state, state);
  assert.match(createManagedActivity(state, weeklyInput, [], now).result.error, /al menos un horario/);
  assert.match(
    createManagedActivity(state, { ...weeklyInput, startsOn: "2030-06-06" }, [weeklySlot], now).result.error,
    /fecha de inicio/,
  );
  const created = createManagedActivity(state, weeklyInput, [weeklySlot], now);
  assert.equal(created.result.success, true);
  state = created.state;
  const activity = created.result.activity;
  assert.equal(state.slots.some((slot) => slot.activityId === activity.id), true);
  assert.equal(state.sessions.some((candidate) => candidate.activityId === activity.id), true);
  const oneOff = createManagedActivity(
    state,
    { ...weeklyInput, name: "Seminario", scheduleKind: "ONE_OFF", allowsRecurring: false, startsOn: null, endsOn: null },
    [{ ...weeklySlot, dayOfWeek: null, date: "2030-06-12" }],
    now,
  );
  assert.equal(oneOff.result.success, true);
  assert.equal(oneOff.state.sessions.some((candidate) => candidate.activityId === oneOff.result.activity.id && candidate.date === "2030-06-12"), true);

  state = asActor(state, "teacher-demo");
  const teacherCreated = createManagedActivity(state, { ...weeklyInput, teacherId: "teacher-other", name: "Own class" }, [weeklySlot], now);
  assert.equal(teacherCreated.result.success, true);
  assert.equal(teacherCreated.result.activity.teacherId, "teacher-demo");
  assert.match(
    updateManagedActivity(state, "activity-strength", { ...weeklyInput, teacherId: "teacher-other" }, now).result.error,
    /No autorizado/,
  );
  const oldSessionCapacity = session(state).capacity;
  const updated = updateManagedActivity(state, "activity-strength", { ...weeklyInput, capacity: 99 }, now);
  assert.equal(updated.result.success, true);
  assert.equal(session(updated.state).capacity, oldSessionCapacity, "default capacity never rewrites a snapshot");
});

test("slot create, edit, and deactivate enforce local overlap, validity, and ownership", () => {
  let state = fixture();
  assert.match(
    manageSlot(state, "activity-strength", { ...weeklySlot, startMinute: 1100, endMinute: 1200 }).result.error,
    /superpuestos/,
  );
  const added = manageSlot(state, "activity-strength", weeklySlot);
  assert.equal(added.result.success, true);
  state = added.state;
  const slotId = added.result.slot.id;
  const edited = manageSlot(state, "activity-strength", { ...weeklySlot, startMinute: 21 * 60, endMinute: 22 * 60 }, slotId);
  assert.equal(edited.result.success, true);
  state = edited.state;
  assert.match(
    manageSlot(state, "activity-strength", { ...weeklySlot, dayOfWeek: null }, slotId).result.error,
    /día de la semana/,
  );
  state = asActor(state, "teacher-other");
  assert.match(deactivateManagedSlot(state, "activity-strength", slotId).result.error, /No autorizado/);
  state = asActor(state, "teacher-demo");
  const deactivated = deactivateManagedSlot(state, "activity-strength", slotId);
  assert.equal(deactivated.result.success, true);
  assert.equal(deactivated.state.slots.find((slot) => slot.id === slotId).active, false);
});

test("creating a slot immediately materializes its bounded upcoming sessions without changing edits", () => {
  const state = fixture();
  const rejected = reduceManagementDemo(
    state,
    {
      type: "create-slot",
      activityId: "activity-strength",
      input: { dayOfWeek: 3, date: null, startMinute: 1100, endMinute: 1200, capacity: null },
    },
    now,
  );
  assert.strictEqual(rejected.state, state, "a rejected create leaves the graph untouched");
  assert.equal(rejected.result.success, false);

  const created = reduceManagementDemo(
    state,
    {
      type: "create-slot",
      activityId: "activity-strength",
      input: { dayOfWeek: 6, date: null, startMinute: 20 * 60, endMinute: 21 * 60, capacity: 4 },
    },
    now,
  );
  assert.equal(created.result.success, true);
  assert.equal("slot" in created.result, true);
  const slotId = created.result.slot.id;
  assert.equal(created.state.sessions.filter((candidate) => candidate.slotId === slotId).length, 4);

  const edited = reduceManagementDemo(
    created.state,
    {
      type: "update-slot",
      activityId: "activity-strength",
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
  const originalSession = state.sessions.find((candidate) => candidate.slotId === "slot-strength-wed");
  const originalSnapshot = {
    date: originalSession.date,
    startsAt: originalSession.startsAt,
    endsAt: originalSession.endsAt,
    capacity: originalSession.capacity,
  };
  const edited = reduceManagementDemo(
    state,
    {
      type: "update-slot",
      activityId: "activity-strength",
      slotId: "slot-strength-wed",
      input: { dayOfWeek: 3, date: null, startMinute: 17 * 60, endMinute: 18 * 60, capacity: null },
    },
    now,
  );
  assert.equal(edited.result.success, true);
  assert.deepEqual(
    edited.state.sessions.find((candidate) => candidate.id === originalSession.id),
    { ...originalSession, ...originalSnapshot },
  );
  const restored = restoreManagementDemoState(serializeManagementDemoState(edited.state), "2031-01-01", now);
  assert.equal(restored.slots.find((slot) => slot.id === "slot-strength-wed").startMinute, 17 * 60);
  assert.deepEqual(
    restored.sessions.find((candidate) => candidate.id === originalSession.id),
    { ...originalSession, ...originalSnapshot },
  );
  const future = materializeUpcomingSessions(restored, new Date("2030-07-01T15:00:00.000Z"));
  const newSession = future.state.sessions.find((candidate) => candidate.slotId === "slot-strength-wed" && candidate.date === "2030-07-03");
  assert.equal(newSession.startsAt, "2030-07-03T20:00:00.000Z");

  const oneOff = reduceManagementDemo(
    restored,
    {
      type: "update-slot",
      activityId: "activity-open-box",
      slotId: "slot-open-box-once",
      input: { dayOfWeek: null, date: "2030-06-12", startMinute: 19 * 60, endMinute: 20 * 60, capacity: null },
    },
    now,
  );
  assert.equal(oneOff.result.success, true);
  assert.equal(restoreManagementDemoState(serializeManagementDemoState(oneOff.state), "2031-01-01", now).slots.find((slot) => slot.id === "slot-open-box-once").date, "2030-06-12");
});

test("materialization is idempotent, bounded to four weeks, and uses safe Buenos Aires rollover", () => {
  let state = fixture();
  state = { ...state, sessions: [], bookings: [], enrollments: [] };
  const materialized = materializeUpcomingSessions(state, now);
  assert.equal(materialized.result.sessionsCreated > 0, true);
  assert.equal(materialized.state.sessions.every((candidate) => candidate.date >= "2030-06-03" && candidate.date < "2030-07-01"), true);
  const repeat = materializeUpcomingSessions(materialized.state, now);
  assert.equal(repeat.result.sessionsCreated, 0);
  const late = materialized.state.sessions.find((candidate) => candidate.slotId === "slot-open-box-once");
  assert.match(late.startsAt, /T02:30:00\.000Z$/);
  assert.match(late.endsAt, /T03:00:00\.000Z$/);
});

test("staff session cancellation immediately cancels every confirmed normalized booking", () => {
  const state = fixture();
  const target = session(state);
  const cancelled = cancelManagedSession(state, target.id, now);
  assert.equal(cancelled.result.success, true);
  assert.equal(cancelled.state.sessions.find((candidate) => candidate.id === target.id).cancelled, true);
  assert.equal(toManagedSessionRows(cancelled.state, "activity-strength")[0].bookedCount, 0);
  assert.equal(cancelled.state.bookings.filter((booking) => booking.sessionId === target.id).every((booking) => booking.status === "CANCELLED"), true);
  assert.match(cancelManagedSession(cancelled.state, target.id, now).result.error, /ya está cancelada/);
  assert.match(cancelManagedSession(asActor(state, "teacher-other"), target.id, now).result.error, /No autorizado/);
});

test("staff can book LITE, rejects duplicate/full/past/cancelled cases, and can unbook", () => {
  let state = fixture();
  const boxing = session(state, "activity-boxing");
  const booked = manuallyBookStudent(state, boxing.id, "student-lite", now);
  assert.equal(booked.result.success, true);
  state = booked.state;
  assert.equal(toEnrollmentBookingRows(state, boxing.id)[0].accountKind, "LITE");
  assert.match(manuallyBookStudent(state, boxing.id, "student-lite", now).result.error, /ya está anotado/);
  const unbooked = manuallyUnbookStudent(state, booked.result.bookingId, now);
  assert.equal(unbooked.result.success, true);
  assert.equal(toManagedSessionRows(unbooked.state, "activity-boxing")[0].bookedCount, 0);

  const full = session(state);
  assert.match(manuallyBookStudent(state, full.id, "student-ana", now).result.error, /No hay cupo/);
  const pastState = { ...state, sessions: state.sessions.map((candidate) => candidate.id === boxing.id ? { ...candidate, startsAt: "2030-06-01T22:00:00.000Z" } : candidate) };
  assert.match(manuallyBookStudent(pastState, boxing.id, "student-ana", now).result.error, /sesión pasada/);
  const cancelled = cancelManagedSession(state, boxing.id, now).state;
  assert.match(manuallyBookStudent(cancelled, boxing.id, "student-ana", now).result.error, /cancelada/);
});

test("FULL students act only for themselves while LITE remains staff-only", () => {
  let state = asActor(fixture(), "student-lite");
  const boxing = session(state, "activity-boxing");
  assert.match(studentBookSession(state, "student-lite", boxing.id, now).result.error, /no puede reservar/);
  state = asActor(state, "student-full");
  assert.match(studentBookSession(state, "student-mateo", boxing.id, now).result.error, /no puede reservar/);
  const booked = studentBookSession(state, "student-full", boxing.id, now);
  assert.equal(booked.result.success, true);
  assert.equal(booked.result.bookingId !== undefined, true);
  assert.match(studentBookSession(booked.state, "student-full", boxing.id, now).result.error, /Ya estás anotado/);
});

test("recurring enrollment keeps an occurrence cancellation and ending it removes only future derived bookings", () => {
  let state = asActor(fixture(), "student-mateo");
  const enrolled = studentEnrollInSlot(state, "student-mateo", "slot-strength-wed", now);
  assert.equal(enrolled.result.success, true);
  state = enrolled.state;
  const derived = state.bookings.find((booking) => booking.enrollmentId === enrolled.result.enrollmentId && booking.status === "CONFIRMED");
  const cancelledOccurrence = studentCancelBooking(state, "student-mateo", derived.id, now);
  assert.equal(cancelledOccurrence.result.success, true);
  assert.equal(cancelledOccurrence.state.enrollments.find((enrollment) => enrollment.id === enrolled.result.enrollmentId).status, "ACTIVE");

  const withHistory = {
    ...cancelledOccurrence.state,
    sessions: cancelledOccurrence.state.sessions.map((candidate) => candidate.id === derived.sessionId ? { ...candidate, startsAt: "2030-06-01T21:00:00.000Z" } : candidate),
  };
  const ended = studentCancelEnrollment(withHistory, "student-mateo", enrolled.result.enrollmentId, now);
  assert.equal(ended.result.success, true);
  assert.equal(ended.state.bookings.find((booking) => booking.id === derived.id).status, "CANCELLED", "occurrence remains historical cancellation");
  assert.equal(ended.state.bookings.filter((booking) => booking.enrollmentId === enrolled.result.enrollmentId && booking.status === "CONFIRMED").length, 0);
  assert.match(studentCancelEnrollment(ended.state, "student-mateo", enrolled.result.enrollmentId, now).result.error, /ya estaba cancelada/);
});

test("student cancellation honors the window and preserves the enrollment source relation", () => {
  let state = asActor(fixture(), "student-full");
  const booking = state.bookings.find((candidate) => candidate.studentId === "student-full" && candidate.source === "SINGLE");
  const target = state.sessions.find((candidate) => candidate.id === booking.sessionId);
  const late = new Date(new Date(target.startsAt).getTime() - 60 * 60 * 1000);
  assert.match(studentCancelBooking(state, "student-full", booking.id, late).result.error, /al menos 4hs/);
  const early = studentCancelBooking(state, "student-full", booking.id, now);
  assert.equal(early.result.success, true);
  assert.equal(early.state.enrollments.find((enrollment) => enrollment.id === "enrollment-strength-julia").status, "ACTIVE");
});

test("deletion preview deletes unused graphs and archives booked history without hard deletion", () => {
  let state = fixture();
  const created = createManagedActivity(state, weeklyInput, [weeklySlot], now);
  state = created.state;
  const unusedId = created.result.activity.id;
  const previewUnused = previewManagedActivityDeletion(state, unusedId, now);
  assert.deepEqual(previewUnused.result, { success: true, willArchive: false, futureBookedStudents: 0 });
  const deleted = deleteManagedActivity(state, unusedId, now);
  assert.equal(deleted.result.mode, "deleted");
  assert.equal(deleted.state.activities.some((activity) => activity.id === unusedId), false);

  const previewBooked = previewManagedActivityDeletion(state, "activity-strength", now);
  assert.equal(previewBooked.result.willArchive, true);
  const archived = deleteManagedActivity(state, "activity-strength", now);
  assert.equal(archived.result.mode, "archived");
  assert.equal(archived.state.activities.find((activity) => activity.id === "activity-strength").active, false);
  assert.equal(archived.state.bookings.some((booking) => booking.id === "booking-strength-julia-first"), true);
});

test("student projections hide inactive schedules while retaining the production-equivalent booking history", () => {
  let state = fixture();
  const added = reduceManagementDemo(
    state,
    {
      type: "create-slot",
      activityId: "activity-strength",
      input: { dayOfWeek: 3, date: null, startMinute: 20 * 60, endMinute: 21 * 60, capacity: null },
    },
    now,
  );
  assert.equal(added.result.success, true);
  state = deactivateManagedSlot(added.state, "activity-strength", "slot-strength-wed").state;
  assert.equal(toStudentSessionRows(state, "student-full", now).some((row) => row.slotId === "slot-strength-wed"), false);
  assert.equal(toMyBookingRows(state, "student-full", now).some((row) => row.bookingId === "booking-strength-julia-first"), true);
  assert.equal(toMyEnrollmentRows(state, "student-full").some((row) => row.enrollmentId === "enrollment-strength-julia"), true);

  const archived = deleteManagedActivity(state, "activity-strength", now).state;
  assert.equal(toStudentSessionRows(archived, "student-full", now).some((row) => row.activityName === "Fuerza"), false);
  assert.equal(toMyBookingRows(archived, "student-full", now).some((row) => row.activityName === "Fuerza"), false);
  assert.equal(archived.bookings.some((booking) => booking.id === "booking-strength-julia-first" && booking.status === "CANCELLED"), true);
  assert.equal(toMyEnrollmentRows(archived, "student-full").some((row) => row.enrollmentId === "enrollment-strength-julia"), true);
});

test("command reducer returns callback-shaped transitions for adapters", () => {
  const state = fixture();
  const selected = reduceManagementDemo(state, { type: "select-actor", actorId: "student-full" }, now);
  assert.deepEqual(selected.result, { success: true });
  const booked = reduceManagementDemo(selected.state, { type: "student-book", studentId: "student-full", sessionId: session(selected.state, "activity-boxing").id }, now);
  assert.equal(booked.result.success, true);
  assert.equal("bookingId" in booked.result, true);
});

test("versioned restore rejects malformed nested data, relations, capacity semantics, and unknown versions", () => {
  const state = fixture();
  const raw = serializeManagementDemoState(state);
  assert.equal(restoreManagementDemoState(raw, "2031-01-01", now).anchorDate, anchor);
  const malformed = [
    { ...state, version: 999 },
    { ...state, actors: [{ id: "bad", name: "Bad", role: "STUDENT", accountKind: "BROKEN" }] },
    { ...state, activities: [{ ...state.activities[0], startsOn: "2030-02-30" }] },
    { ...state, slots: [{ ...state.slots[0], activityId: "missing" }] },
    { ...state, sessions: [{ ...state.sessions[0], slotId: "slot-boxing-fri" }] },
    { ...state, bookings: [{ ...state.bookings[0], studentId: "missing" }] },
    { ...state, enrollments: [{ ...state.enrollments[0], slotId: "slot-boxing-fri" }] },
    { ...state, bookings: [...state.bookings, { ...state.bookings[0], id: "duplicate" }] },
    { ...state, sessions: [{ ...state.sessions[0], capacity: 1 }] },
    { ...state, sessions: [{ ...state.sessions[0], date: "2030-06-06" }] },
  ];
  for (const candidate of malformed) {
    assert.equal(isValidManagementDemoState(candidate), false);
    assert.equal(restoreManagementDemoState(JSON.stringify(candidate), "2031-01-01", now).anchorDate, "2031-01-01");
  }
  assert.equal(restoreManagementDemoState("not-json", "2031-01-01", now).anchorDate, "2031-01-01");
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
          ...state.slots.find((slot) => slot.id === "slot-strength-wed"),
          id: "slot-strength-overlap",
          startMinute: 1100,
          endMinute: 1200,
        },
      ],
    },
    {
      ...state,
      slots: state.slots.map((slot) =>
        slot.id === "slot-strength-wed" ? { ...slot, active: false } : slot,
      ),
    },
    {
      ...state,
      slots: [
        ...state.slots.map((slot) =>
          slot.activityId === "activity-strength" ? { ...slot, active: false } : slot,
        ),
        {
          id: "slot-strength-friday",
          activityId: "activity-strength",
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
    assert.equal(isValidManagementDemoState(candidate), false);
    assert.equal(restoreManagementDemoState(JSON.stringify(candidate), "2031-01-01", now).anchorDate, "2031-01-01");
  }

  const inactiveHistorical = {
    ...state,
    activities: state.activities.map((activity) =>
      activity.id === "activity-strength" ? { ...activity, active: false } : activity,
    ),
    slots: state.slots.map((slot) =>
      slot.activityId === "activity-strength" ? { ...slot, active: false } : slot,
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
  assert.equal(isValidManagementDemoState(inactiveHistorical), true);
  assert.equal(restoreManagementDemoState(JSON.stringify(inactiveHistorical), "2031-01-01", now).anchorDate, anchor);
});

test("re-enrolling a slot after cancelling the whole enrollment revives every confirmed booking the enrollment had", () => {
  let state = asActor(fixture(), "student-full");
  const originalConfirmed = state.bookings.filter(
    (booking) => booking.enrollmentId === "enrollment-strength-julia" && booking.status === "CONFIRMED",
  );
  assert.equal(originalConfirmed.length, 3);

  const ended = studentCancelEnrollment(state, "student-full", "enrollment-strength-julia", now);
  assert.equal(ended.result.success, true);
  assert.equal(
    ended.state.bookings.filter((booking) => booking.enrollmentId === "enrollment-strength-julia" && booking.status === "CONFIRMED").length,
    0,
  );
  assert.equal(
    ended.state.bookings.filter((booking) => booking.studentId === "student-full" && booking.status === "CONFIRMED").length,
    1,
    "the original SINGLE booking on the first occurrence must remain untouched",
  );

  const reEnrolled = studentEnrollInSlot(ended.state, "student-full", "slot-strength-wed", now);
  assert.equal(reEnrolled.result.success, true);
  assert.equal(reEnrolled.result.enrollmentId, "enrollment-strength-julia");
  assert.equal(reEnrolled.result.bookingsCreated, 3, "re-enrolling must revive every previously cancelled occurrence");
  const revivedConfirmed = reEnrolled.state.bookings.filter(
    (booking) => booking.enrollmentId === "enrollment-strength-julia" && booking.status === "CONFIRMED",
  );
  assert.equal(revivedConfirmed.length, 3);
  assert.deepEqual(
    revivedConfirmed.map((booking) => booking.sessionId).sort(),
    originalConfirmed.map((booking) => booking.sessionId).sort(),
  );
  assert.equal(
    reEnrolled.state.bookings.filter((booking) => booking.studentId === "student-full" && booking.status === "CONFIRMED").length,
    4,
    "total confirmed bookings must match the original seeded enrollment (1 SINGLE + 3 ENROLLMENT)",
  );
});

test("cancelling one enrollment occurrence survives a rolling-window re-materialization", () => {
  // A slot created through the command (rather than the seeded fixture) gets its session ids from
  // the same `session-${slot.id}-${date}` scheme the window materializer itself uses, so removing
  // and re-adding one of its sessions below reproduces exactly what a rolling window does.
  const created = createManagedActivity(fixture(), weeklyInput, [weeklySlot], now);
  assert.equal(created.result.success, true);
  const slotId = created.state.slots.find((slot) => slot.activityId === created.result.activity.id).id;
  let state = asActor(created.state, "student-ana");
  const enrolled = studentEnrollInSlot(state, "student-ana", slotId, now);
  assert.equal(enrolled.result.success, true);
  state = enrolled.state;
  const anaBooking = state.bookings.find(
    (booking) => booking.enrollmentId === enrolled.result.enrollmentId && booking.status === "CONFIRMED",
  );
  const cancelled = studentCancelBooking(state, "student-ana", anaBooking.id, now);
  assert.equal(cancelled.result.success, true);
  state = cancelled.state;
  assert.equal(state.bookings.find((booking) => booking.id === anaBooking.id).status, "CANCELLED");

  // Simulate this occurrence not yet being re-materialized (as if the rolling window had not
  // reached it again), while its cancelled booking row already exists — exactly the shape the
  // real window materializer must not silently revive.
  const withoutSession = { ...state, sessions: state.sessions.filter((session) => session.id !== anaBooking.sessionId) };
  const remade = materializeUpcomingSessions(withoutSession, now);
  assert.equal(remade.result.success, true);
  assert.equal(remade.state.sessions.some((session) => session.id === anaBooking.sessionId), true, "the session must be rematerialized");
  assert.equal(
    remade.state.bookings.find((booking) => booking.id === anaBooking.id).status,
    "CANCELLED",
    "the rolling window must never revive a booking the student deliberately cancelled",
  );
  assert.equal(
    remade.state.bookings.filter(
      (booking) => booking.sessionId === anaBooking.sessionId && booking.studentId === "student-ana",
    ).length,
    1,
    "no duplicate booking row must be created for this session/student pair",
  );
});

test("reviving a cancelled enrollment booking on re-enroll still respects session capacity", () => {
  let state = asActor(fixture(), "student-full");
  const ended = studentCancelEnrollment(state, "student-full", "enrollment-strength-julia", now);
  assert.equal(ended.result.success, true);
  state = ended.state;

  // Fill one of Julia's three now-cancelled sessions back up to capacity (3) with three other
  // staff-booked students (that session has no other confirmed booking left after the cancel).
  const fullSessionId = state.bookings.find(
    (booking) => booking.enrollmentId === "enrollment-strength-julia" && booking.status === "CANCELLED",
  ).sessionId;
  let staffState = asActor(state, "admin-demo");
  staffState = manuallyBookStudent(staffState, fullSessionId, "student-lite", now).state;
  staffState = manuallyBookStudent(staffState, fullSessionId, "student-mateo", now).state;
  staffState = manuallyBookStudent(staffState, fullSessionId, "student-ana", now).state;
  assert.equal(toManagedSessionRows(staffState, "activity-strength").find((row) => row.id === fullSessionId).bookedCount, 3);

  const reEnrollState = asActor(staffState, "student-full");
  const reEnrolled = studentEnrollInSlot(reEnrollState, "student-full", "slot-strength-wed", now);
  assert.equal(reEnrolled.result.success, true);
  assert.equal(reEnrolled.result.bookingsCreated, 2, "the full session must refuse the revive; the other two occurrences still revive");
  const juliaBookingOnFullSession = reEnrolled.state.bookings.find(
    (booking) => booking.sessionId === fullSessionId && booking.studentId === "student-full",
  );
  assert.equal(juliaBookingOnFullSession.status, "CANCELLED", "the capacity guard must keep the revive refused");
});

test("one student enrolling in a slot must not revive another student's deliberately cancelled occurrence on the same slot", () => {
  let state = asActor(fixture(), "student-full");
  const juliaBooking = state.bookings.find(
    (booking) => booking.enrollmentId === "enrollment-strength-julia" && booking.status === "CONFIRMED",
  );
  const cancelled = studentCancelBooking(state, "student-full", juliaBooking.id, now);
  assert.equal(cancelled.result.success, true);
  state = cancelled.state;
  assert.equal(state.bookings.find((booking) => booking.id === juliaBooking.id).status, "CANCELLED");
  const juliaConfirmedBefore = state.bookings.filter(
    (booking) => booking.studentId === "student-full" && booking.status === "CONFIRMED",
  ).length;

  const enrollState = asActor(state, "student-mateo");
  const enrolled = studentEnrollInSlot(enrollState, "student-mateo", "slot-strength-wed", now);
  assert.equal(enrolled.result.success, true);

  assert.equal(
    enrolled.state.bookings.find((booking) => booking.id === juliaBooking.id).status,
    "CANCELLED",
    "another student's enrollment must never revive Julia's deliberately cancelled occurrence",
  );
  assert.equal(
    enrolled.state.bookings.filter(
      (booking) => booking.studentId === "student-full" && booking.status === "CONFIRMED",
    ).length,
    juliaConfirmedBefore,
    "Julia's confirmed count must be unchanged by another student's enrollment",
  );
});
