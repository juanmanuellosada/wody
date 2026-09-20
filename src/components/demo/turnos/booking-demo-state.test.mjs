import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEMO_STORAGE_KEY,
  createDemoState,
  loadDemoState,
  reduceDemoBooking,
  resetDemoState,
  saveDemoState,
  toCalendarSessions,
  toMyBookingRows,
} from "./booking-demo-state.ts";

const anchor = "2030-06-03";
const demoNow = new Date(`${anchor}T15:00:00.000Z`);

function command(state, value, now = demoNow) {
  return reduceDemoBooking(state, value, now);
}

test("FULL supports punctual booking, rejects duplicates, and preserves a full slot", () => {
  let state = createDemoState(anchor);
  const punctual = command(state, { type: "book-single", sessionId: "session-strength-1" });
  assert.deepEqual(punctual.result, { success: true, bookingId: "booking-session-strength-1" });
  state = punctual.state;
  assert.equal(toCalendarSessions(state, demoNow).find((session) => session.id === "session-strength-1")?.bookedCount, 8);
  assert.match(command(state, { type: "book-single", sessionId: "session-strength-1" }).result.error, /Ya estás anotado/);
  const oneOff = command(state, { type: "book-single", sessionId: "session-handstand" });
  assert.equal(oneOff.result.success, true);
  assert.equal(toCalendarSessions(oneOff.state, demoNow).find((session) => session.id === "session-handstand")?.dayOfWeek, null);
  assert.match(command(state, { type: "book-single", sessionId: "session-mobility-full" }).result.error, /No hay cupo/);
});

test("LITE keeps the real booking restriction while FULL can resume booking", () => {
  let state = createDemoState(anchor);
  state = command(state, { type: "set-account-kind", accountKind: "LITE" }).state;
  assert.match(command(state, { type: "book-single", sessionId: "session-strength-1" }).result.error, /LITE/);
  state = command(state, { type: "set-account-kind", accountKind: "FULL" }).state;
  assert.equal(command(state, { type: "book-single", sessionId: "session-strength-1" }).result.success, true);
});

test("recurrent enrollment derives bookings, while cancelling one occurrence preserves enrollment", () => {
  let state = createDemoState(anchor);
  const enrollment = command(state, { type: "enroll-slot", slotId: "slot-strength-wed" });
  assert.equal(enrollment.result.success, true);
  assert.equal(enrollment.result.bookingsCreated, 3);
  state = enrollment.state;
  assert.equal(state.enrollments.length, 1);
  assert.equal(toMyBookingRows(state, demoNow).filter((booking) => booking.activityName === "Fuerza").length, 3);
  assert.match(command(state, { type: "enroll-slot", slotId: "slot-strength-wed" }).result.error, /Ya estás inscripto/);

  const occurrence = state.sessions.find((session) => session.slotId === "slot-strength-wed")?.booking;
  assert.ok(occurrence);
  const cancelled = command(state, { type: "cancel-booking", bookingId: occurrence.id });
  assert.equal(cancelled.result.success, true);
  assert.equal(cancelled.state.enrollments.length, 1);
  assert.equal(toMyBookingRows(cancelled.state, demoNow).filter((booking) => booking.activityName === "Fuerza").length, 2);
});

test("cancellation window blocks late cancellations and cancelling enrollment removes only future derived bookings", () => {
  let state = createDemoState(anchor);
  const nearSession = state.sessions.find((session) => session.id === "session-open-box");
  assert.ok(nearSession);
  state = {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === "session-open-box" ? { ...session, startsAt: `${anchor}T16:00:00.000Z` } : session
    ),
  };
  assert.match(command(state, { type: "cancel-booking", bookingId: "booking-open-box" }).result.error, /Ya no se puede cancelar/);

  state = createDemoState(anchor);
  state = command(state, { type: "enroll-slot", slotId: "slot-strength-wed" }).state;
  const pastId = "session-strength-1";
  state = {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === pastId ? { ...session, startsAt: "2030-06-02T21:00:00.000Z" } : session
    ),
  };
  const enrollmentId = state.enrollments[0].enrollmentId;
  const cancelled = command(state, { type: "cancel-enrollment", enrollmentId });
  assert.equal(cancelled.result.success, true);
  assert.equal(cancelled.state.enrollments.length, 0);
  assert.ok(cancelled.state.sessions.find((session) => session.id === pastId)?.booking, "past derived booking remains");
  assert.equal(toMyBookingRows(cancelled.state, demoNow).filter((booking) => booking.activityName === "Fuerza").length, 0, "historical booking remains stored but is not visible");
});

test("projections match production future/cancelled boundaries and callbacks reject stale sessions", () => {
  const evening = new Date("2030-06-08T23:01:00.000Z");
  let state = createDemoState("2030-06-08");
  const mobilityId = "session-mobility-full";
  assert.equal(toCalendarSessions(state, evening).some((session) => session.id === mobilityId), false, "past same-day class is hidden");

  state = {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === "session-handstand"
        ? { ...session, booking: { id: "booking-handstand", source: "SINGLE" }, cancelled: true }
        : session
    ),
  };
  assert.equal(toCalendarSessions(state, evening).some((session) => session.id === "session-handstand"), true, "calendar retains cancelled future sessions");
  assert.equal(toMyBookingRows(state, evening).some((booking) => booking.bookingId === "booking-handstand"), false, "My Turnos excludes cancelled sessions");

  state = {
    ...state,
    sessions: state.sessions.map((session) =>
      session.id === "session-handstand"
        ? { ...session, cancelled: false, startsAt: "2030-06-08T20:00:00.000Z", endsAt: "2030-06-08T21:00:00.000Z" }
        : session
    ),
  };
  assert.match(command(state, { type: "book-single", sessionId: "session-handstand" }, evening).result.error, /ya no está disponible/i);
  assert.equal(toMyBookingRows(state, evening).some((booking) => booking.bookingId === "booking-handstand"), false, "past bookings stay stored but are not projected");

  const boundaryState = {
    ...createDemoState(anchor),
    sessions: createDemoState(anchor).sessions.map((session) =>
      session.id === "session-handstand"
        ? { ...session, startsAt: demoNow.toISOString(), endsAt: "2030-06-03T16:00:00.000Z", booking: { id: "booking-boundary", source: "SINGLE" } }
        : session
    ),
  };
  assert.equal(toCalendarSessions(boundaryState, demoNow).some((session) => session.id === "session-handstand"), true);
  assert.equal(toMyBookingRows(boundaryState, demoNow).some((booking) => booking.bookingId === "booking-boundary"), true);
});

test("versioned storage recovers from corrupt or unavailable browser storage and reset restores fixtures", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const original = createDemoState(anchor);
  assert.equal(saveDemoState(storage, original), true);
  assert.equal(loadDemoState(storage, "2030-06-04").anchorDate, anchor);
  values.set(DEMO_STORAGE_KEY, "not-json");
  assert.equal(loadDemoState(storage, "2030-06-04").anchorDate, "2030-06-04");
  values.set(DEMO_STORAGE_KEY, JSON.stringify({ version: 999 }));
  assert.equal(loadDemoState(storage, "2030-06-04").sessions.length, original.sessions.length);

  const malformedStates = [
    (() => { const value = structuredClone(original); delete value.sessions[0].activityName; return value; })(),
    (() => { const value = structuredClone(original); value.sessions[0].capacity = -1; return value; })(),
    (() => { const value = structuredClone(original); value.sessions[0].booking = { id: "bad-source", source: "REMOTE" }; return value; })(),
    (() => { const value = structuredClone(original); value.sessions[0].endsAt = value.sessions[0].startsAt; return value; })(),
    (() => { const value = structuredClone(original); value.enrollments = [{ enrollmentId: "bad", slotId: "missing", activityName: "Fuerza", dayOfWeek: 3, startMinute: 1080, endMinute: 1140 }]; return value; })(),
  ];
  for (const malformed of malformedStates) {
    values.set(DEMO_STORAGE_KEY, JSON.stringify(malformed));
    assert.equal(loadDemoState(storage, "2030-06-04").anchorDate, "2030-06-04");
  }
  assert.equal(resetDemoState(storage, "2030-06-05").anchorDate, "2030-06-05");

  const blockedStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.equal(loadDemoState(blockedStorage, anchor).anchorDate, anchor);
  assert.equal(saveDemoState(blockedStorage, original), false);
  assert.equal(resetDemoState(blockedStorage, anchor).sessions.length, original.sessions.length);
});

test("production adapters keep action mappings, while the preview graph contains no operational imports", async () => {
  const root = new URL("../../", import.meta.url);
  const source = (path) => readFile(new URL(path, root), "utf8");
  const [calendarWrapper, myTurnosWrapper, calendarView, myTurnosView, demo] = await Promise.all([
    source("activity/TurnosCalendar.tsx"),
    source("activity/MyTurnos.tsx"),
    source("activity/views/TurnosCalendarView.tsx"),
    source("activity/views/MyTurnosView.tsx"),
    source("demo/turnos/BoxBookingDemo.tsx"),
  ]);

  assert.match(calendarWrapper, /bookSingleSession\(row\.id\)/);
  assert.match(calendarWrapper, /enrollInSlot\(row\.slotId\)/);
  assert.match(calendarWrapper, /cancelBooking\(row\.bookingId!\)/);
  assert.match(calendarWrapper, /if \(result\.success\) router\.refresh\(\)/);
  assert.match(myTurnosWrapper, /cancelBooking\(row\.bookingId\)/);
  assert.match(myTurnosWrapper, /cancelEnrollment\(row\.enrollmentId\)/);
  assert.match(calendarView, /onBookSingle: \(row: StudentSessionRow\)/);
  assert.match(myTurnosView, /onCancelEnrollment: \(row: MyEnrollmentRow\)/);

  for (const value of [calendarView, myTurnosView, demo]) {
    assert.doesNotMatch(value, /@\/actions|@prisma|@\/lib\/auth|next\/cache|next\/navigation/);
  }
});
