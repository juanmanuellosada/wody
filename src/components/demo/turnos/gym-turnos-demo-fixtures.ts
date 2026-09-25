import type { ActivityRow } from "../../activity/views/view-models";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_DEMO_ADMIN_ID, GYM_DEMO_GENERAL_STUDENT_ID, GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID, GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID, getGymDemoProfiles } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_TURNOS_DEMO_VERSION } from "./gym-turnos-demo-types.ts";
import type { GymTurnosDemoActor, GymTurnosDemoState, GymManagedBooking, GymManagedSession, GymManagedSlot } from "./gym-turnos-demo-types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(date: string): [number, number, number] {
  if (!DATE_PATTERN.test(date)) throw new Error("Demo anchor date must be YYYY-MM-DD.");
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    throw new Error("Demo anchor date must be a calendar date.");
  }
  return [year, month, day];
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = parseDateKey(date);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function dayOfWeek(date: string): number {
  const [year, month, day] = parseDateKey(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function nextCalendarDay(date: string, wantedDay: number): string {
  return addCalendarDays(date, (wantedDay - dayOfWeek(date) + 7) % 7);
}

/** Buenos Aires is UTC-03:00. Date.UTC handles the next-day rollover safely. */
export function buenosAiresInstant(date: string, minute: number): string {
  const [year, month, day] = parseDateKey(date);
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) {
    throw new Error("Demo minute must be between 0 and 1440.");
  }
  return new Date(Date.UTC(year, month - 1, day, 0, minute + 180)).toISOString();
}

export function buenosAiresDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function session(
  id: string,
  activityId: string,
  slotId: string,
  date: string,
  startMinute: number,
  endMinute: number,
  capacity: number | null,
): GymManagedSession {
  return {
    id,
    activityId,
    slotId,
    date,
    startsAt: buenosAiresInstant(date, startMinute),
    endsAt: buenosAiresInstant(date, endMinute),
    capacity,
    cancelled: false,
  };
}

/**
 * The canonical GYM directory is the only source of actor identity, the way
 * every other GYM module in this effort draws its roster (finance, access,
 * training). Immutable tokens (id/role) stay canonical; accountKind is
 * carried only for STUDENT actors, matching BOX's DemoActor shape. Soft-deleted
 * directory profiles never appear in the turnos roster.
 */
export function getGymTurnosDemoActors(): GymTurnosDemoActor[] {
  return getGymDemoProfiles()
    .filter((profile) => profile.deletedAt === null)
    .map((profile): GymTurnosDemoActor => ({
      id: profile.id,
      name: profile.name,
      role: profile.role,
      accountKind: profile.role === "STUDENT" ? profile.accountKind : null,
    }));
}

function actorName(actors: readonly GymTurnosDemoActor[], id: string): string {
  const actor = actors.find((candidate) => candidate.id === id);
  if (!actor) throw new Error(`Demo fixture references an unknown canonical actor id: ${id}`);
  return actor.name;
}

/** Deterministic normalized fixtures for a supplied Buenos Aires calendar day. */
export function createGymTurnosDemoFixture(anchorDate: string): GymTurnosDemoState {
  parseDateKey(anchorDate);
  const actors = getGymTurnosDemoActors();
  const wednesday = nextCalendarDay(anchorDate, 3);
  const friday = nextCalendarDay(anchorDate, 5);
  const oneOffDate = addCalendarDays(anchorDate, 8);

  const activities: ActivityRow[] = [
    {
      id: "activity-spinning",
      name: "Spinning",
      description: "Cardio en bici",
      teacherId: GYM_DEMO_PRIMARY_TEACHER_ID,
      teacherName: actorName(actors, GYM_DEMO_PRIMARY_TEACHER_ID),
      scheduleKind: "WEEKLY",
      allowsRecurring: true,
      cancelWindowHours: 4,
      capacity: 3,
      startsOn: wednesday,
      endsOn: null,
      active: true,
    },
    {
      id: "activity-funcional",
      name: "Funcional",
      description: "Circuito de fuerza y resistencia",
      teacherId: GYM_DEMO_SECONDARY_TEACHER_ID,
      teacherName: actorName(actors, GYM_DEMO_SECONDARY_TEACHER_ID),
      scheduleKind: "WEEKLY",
      allowsRecurring: false,
      cancelWindowHours: 2,
      capacity: 8,
      startsOn: friday,
      endsOn: null,
      active: true,
    },
    {
      id: "activity-musculacion-libre",
      name: "Musculación libre",
      description: null,
      teacherId: null,
      teacherName: null,
      scheduleKind: "ONE_OFF",
      allowsRecurring: false,
      cancelWindowHours: 2,
      capacity: null,
      startsOn: null,
      endsOn: null,
      active: true,
    },
  ];
  const slots: GymManagedSlot[] = [
    {
      id: "slot-spinning-wed",
      activityId: "activity-spinning",
      dayOfWeek: 3,
      date: null,
      startMinute: 18 * 60,
      endMinute: 19 * 60,
      capacity: null,
      active: true,
    },
    {
      id: "slot-funcional-fri",
      activityId: "activity-funcional",
      dayOfWeek: 5,
      date: null,
      startMinute: 19 * 60,
      endMinute: 20 * 60,
      capacity: 5,
      active: true,
    },
    {
      id: "slot-musculacion-libre-once",
      activityId: "activity-musculacion-libre",
      dayOfWeek: null,
      date: oneOffDate,
      startMinute: 23 * 60 + 30,
      endMinute: 24 * 60,
      capacity: null,
      active: true,
    },
  ];
  const spinningDates = [0, 7, 14, 21].map((days) => addCalendarDays(wednesday, days));
  const sessions: GymManagedSession[] = [
    ...spinningDates.map((date) =>
      session(
        `session-spinning-${date}`,
        "activity-spinning",
        "slot-spinning-wed",
        date,
        18 * 60,
        19 * 60,
        3,
      ),
    ),
    session(
      `session-funcional-${friday}`,
      "activity-funcional",
      "slot-funcional-fri",
      friday,
      19 * 60,
      20 * 60,
      5,
    ),
    session(
      `session-musculacion-libre-${oneOffDate}`,
      "activity-musculacion-libre",
      "slot-musculacion-libre-once",
      oneOffDate,
      23 * 60 + 30,
      24 * 60,
      null,
    ),
  ];
  const bookings: GymManagedBooking[] = [
    {
      id: "booking-spinning-paula-first",
      sessionId: sessions[0].id,
      studentId: GYM_DEMO_GENERAL_STUDENT_ID,
      source: "SINGLE",
      enrollmentId: null,
      status: "CONFIRMED",
      addedByStaff: false,
      cancelledAt: null,
    },
    {
      id: "booking-spinning-leon-first",
      sessionId: sessions[0].id,
      studentId: GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID,
      source: "SINGLE",
      enrollmentId: null,
      status: "CONFIRMED",
      addedByStaff: true,
      cancelledAt: null,
    },
    {
      id: "booking-spinning-irene-first",
      sessionId: sessions[0].id,
      studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID,
      source: "SINGLE",
      enrollmentId: null,
      status: "CONFIRMED",
      addedByStaff: true,
      cancelledAt: null,
    },
    ...sessions.slice(1, 4).map((spinningSession) => ({
      id: `booking-enrollment-paula-${spinningSession.id}`,
      sessionId: spinningSession.id,
      studentId: GYM_DEMO_GENERAL_STUDENT_ID,
      source: "ENROLLMENT" as const,
      enrollmentId: "enrollment-spinning-paula",
      status: "CONFIRMED" as const,
      addedByStaff: false,
      cancelledAt: null,
    })),
  ];

  return {
    version: GYM_TURNOS_DEMO_VERSION,
    anchorDate,
    activeActorId: GYM_DEMO_ADMIN_ID,
    actors,
    activities,
    slots,
    sessions,
    bookings,
    enrollments: [
      {
        id: "enrollment-spinning-paula",
        slotId: "slot-spinning-wed",
        studentId: GYM_DEMO_GENERAL_STUDENT_ID,
        status: "ACTIVE",
        cancelledAt: null,
      },
    ],
  };
}
