import type { ActivityRow } from "../../activity/views/view-models";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { MANAGEMENT_DEMO_VERSION } from "./management-demo-types.ts";
import type { ManagementDemoState, ManagedBooking, ManagedSession, ManagedSlot } from "./management-demo-types";

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
): ManagedSession {
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

/** Deterministic normalized fixtures for a supplied Buenos Aires calendar day. */
export function createManagementDemoFixture(anchorDate: string): ManagementDemoState {
  parseDateKey(anchorDate);
  const wednesday = nextCalendarDay(anchorDate, 3);
  const friday = nextCalendarDay(anchorDate, 5);
  const oneOffDate = addCalendarDays(anchorDate, 8);

  const activities: ActivityRow[] = [
    {
      id: "activity-strength",
      name: "Fuerza",
      description: "Técnica y fuerza",
      teacherId: "teacher-demo",
      teacherName: "Tomás Ríos",
      scheduleKind: "WEEKLY",
      allowsRecurring: true,
      cancelWindowHours: 4,
      capacity: 3,
      startsOn: wednesday,
      endsOn: null,
      active: true,
    },
    {
      id: "activity-boxing",
      name: "Boxeo técnico",
      description: "Golpes y movilidad",
      teacherId: "teacher-other",
      teacherName: "Lucía Vega",
      scheduleKind: "WEEKLY",
      allowsRecurring: false,
      cancelWindowHours: 2,
      capacity: 6,
      startsOn: friday,
      endsOn: null,
      active: true,
    },
    {
      id: "activity-open-box",
      name: "Open Box",
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
  const slots: ManagedSlot[] = [
    {
      id: "slot-strength-wed",
      activityId: "activity-strength",
      dayOfWeek: 3,
      date: null,
      startMinute: 18 * 60,
      endMinute: 19 * 60,
      capacity: null,
      active: true,
    },
    {
      id: "slot-boxing-fri",
      activityId: "activity-boxing",
      dayOfWeek: 5,
      date: null,
      startMinute: 19 * 60,
      endMinute: 20 * 60,
      capacity: 5,
      active: true,
    },
    {
      id: "slot-open-box-once",
      activityId: "activity-open-box",
      dayOfWeek: null,
      date: oneOffDate,
      startMinute: 23 * 60 + 30,
      endMinute: 24 * 60,
      capacity: null,
      active: true,
    },
  ];
  const strengthDates = [0, 7, 14, 21].map((days) => addCalendarDays(wednesday, days));
  const sessions: ManagedSession[] = [
    ...strengthDates.map((date) =>
      session(
        `session-strength-${date}`,
        "activity-strength",
        "slot-strength-wed",
        date,
        18 * 60,
        19 * 60,
        3,
      ),
    ),
    session(
      `session-boxing-${friday}`,
      "activity-boxing",
      "slot-boxing-fri",
      friday,
      19 * 60,
      20 * 60,
      5,
    ),
    session(
      `session-open-box-${oneOffDate}`,
      "activity-open-box",
      "slot-open-box-once",
      oneOffDate,
      23 * 60 + 30,
      24 * 60,
      null,
    ),
  ];
  const bookings: ManagedBooking[] = [
    {
      id: "booking-strength-julia-first",
      sessionId: sessions[0].id,
      studentId: "student-full",
      source: "SINGLE",
      enrollmentId: null,
      status: "CONFIRMED",
      addedByStaff: false,
      cancelledAt: null,
    },
    {
      id: "booking-strength-sofia-first",
      sessionId: sessions[0].id,
      studentId: "student-lite",
      source: "SINGLE",
      enrollmentId: null,
      status: "CONFIRMED",
      addedByStaff: true,
      cancelledAt: null,
    },
    {
      id: "booking-strength-mateo-first",
      sessionId: sessions[0].id,
      studentId: "student-mateo",
      source: "SINGLE",
      enrollmentId: null,
      status: "CONFIRMED",
      addedByStaff: true,
      cancelledAt: null,
    },
    ...sessions.slice(1, 4).map((strengthSession) => ({
      id: `booking-enrollment-julia-${strengthSession.id}`,
      sessionId: strengthSession.id,
      studentId: "student-full",
      source: "ENROLLMENT" as const,
      enrollmentId: "enrollment-strength-julia",
      status: "CONFIRMED" as const,
      addedByStaff: false,
      cancelledAt: null,
    })),
  ];

  return {
    version: MANAGEMENT_DEMO_VERSION,
    anchorDate,
    activeActorId: "admin-demo",
    actors: [
      { id: "admin-demo", name: "Marina Torres", role: "ADMIN" },
      { id: "teacher-demo", name: "Tomás Ríos", role: "TEACHER" },
      { id: "teacher-other", name: "Lucía Vega", role: "TEACHER" },
      { id: "student-full", name: "Julia Acosta", role: "STUDENT", accountKind: "FULL" },
      { id: "student-lite", name: "Sofía Méndez", role: "STUDENT", accountKind: "LITE" },
      { id: "student-mateo", name: "Mateo Sosa", role: "STUDENT", accountKind: "FULL" },
      { id: "student-ana", name: "Ana Ruiz", role: "STUDENT", accountKind: "FULL" },
    ],
    activities,
    slots,
    sessions,
    bookings,
    enrollments: [
      {
        id: "enrollment-strength-julia",
        slotId: "slot-strength-wed",
        studentId: "student-full",
        status: "ACTIVE",
        cancelledAt: null,
      },
    ],
  };
}
