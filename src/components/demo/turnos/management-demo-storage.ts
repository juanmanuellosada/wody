// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { buenosAiresDateKey, dayOfWeek } from "./management-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createManagementDemoState } from "./management-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { MANAGEMENT_DEMO_VERSION, type ManagementDemoState } from "./management-demo-types.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && INSTANT_PATTERN.test(value) && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString() === value;
}

function isCapacity(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isMinute(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 1440;
}

function hasUniqueIds(values: readonly { id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size === values.length;
}

type StoredSlot = {
  id: string;
  activityId: string;
  dayOfWeek: number | null;
  date: string | null;
  startMinute: number;
  endMinute: number;
  active: boolean;
};

type StoredWeeklyActivity = {
  id: string;
  scheduleKind: "WEEKLY" | "ONE_OFF";
  startsOn: string | null;
  active: boolean;
};

function activeSlotsAreCompatible(
  activity: StoredWeeklyActivity,
  slots: readonly StoredSlot[],
): boolean {
  const activeSlots = slots.filter((slot) => slot.activityId === activity.id && slot.active);
  for (let index = 0; index < activeSlots.length; index += 1) {
    for (let other = index + 1; other < activeSlots.length; other += 1) {
      const left = activeSlots[index];
      const right = activeSlots[other];
      const sameOccurrence = activity.scheduleKind === "WEEKLY"
        ? left.dayOfWeek === right.dayOfWeek
        : left.date === right.date;
      if (sameOccurrence && left.startMinute < right.endMinute && right.startMinute < left.endMinute) return false;
    }
  }
  if (activity.scheduleKind !== "WEEKLY") return true;
  // An active weekly activity needs at least one remaining active weekday.
  // Archived activities retain their historical slots and sessions without this live-schedule requirement.
  if (activeSlots.length === 0) return !activity.active;
  const startsOn = activity.startsOn;
  if (startsOn === null) return false;
  return activeSlots.some((slot) => slot.dayOfWeek === dayOfWeek(startsOn));
}

/** Strictly checks the entire persisted graph before it is safe to reuse. */
export function isValidManagementDemoState(value: unknown): value is ManagementDemoState {
  if (!isRecord(value) || value.version !== MANAGEMENT_DEMO_VERSION || !isDateKey(value.anchorDate) || !isId(value.activeActorId)) return false;
  if (!Array.isArray(value.actors) || !Array.isArray(value.activities) || !Array.isArray(value.slots) || !Array.isArray(value.sessions) || !Array.isArray(value.bookings) || !Array.isArray(value.enrollments)) return false;

  const actors = value.actors;
  if (!actors.every((actor) => {
    if (!isRecord(actor) || !isId(actor.id) || !isId(actor.name) || (actor.role !== "ADMIN" && actor.role !== "TEACHER" && actor.role !== "STUDENT")) return false;
    return actor.role === "STUDENT"
      ? actor.accountKind === "FULL" || actor.accountKind === "LITE"
      : actor.accountKind === undefined;
  }) || !hasUniqueIds(actors as { id: string }[]) || !actors.some((actor) => actor.id === value.activeActorId)) return false;
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));

  const activities = value.activities;
  if (!activities.every((activity) => {
    if (!isRecord(activity) || !isId(activity.id) || !isId(activity.name) || (activity.description !== null && typeof activity.description !== "string") || (activity.teacherId !== null && !isId(activity.teacherId)) || (activity.teacherName !== null && !isId(activity.teacherName)) || (activity.scheduleKind !== "WEEKLY" && activity.scheduleKind !== "ONE_OFF") || typeof activity.allowsRecurring !== "boolean" || !isNonNegativeInteger(activity.cancelWindowHours) || !isCapacity(activity.capacity) || typeof activity.active !== "boolean") return false;
    if (activity.teacherId !== null) {
      const teacher = actorById.get(activity.teacherId);
      if (!teacher || teacher.role !== "TEACHER" || teacher.name !== activity.teacherName) return false;
    } else if (activity.teacherName !== null) return false;
    if (activity.scheduleKind === "WEEKLY") {
      return isDateKey(activity.startsOn) && (activity.endsOn === null || isDateKey(activity.endsOn)) && (activity.endsOn === null || activity.endsOn >= activity.startsOn);
    }
    return activity.startsOn === null && activity.endsOn === null;
  }) || !hasUniqueIds(activities as { id: string }[])) return false;
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  const slots = value.slots;
  if (!slots.every((slot) => {
    if (!isRecord(slot) || !isId(slot.id) || !isId(slot.activityId) || !isMinute(slot.startMinute) || !isMinute(slot.endMinute) || slot.endMinute <= slot.startMinute || !isCapacity(slot.capacity) || typeof slot.active !== "boolean") return false;
    const activity = activityById.get(slot.activityId);
    if (!activity) return false;
    return activity.scheduleKind === "WEEKLY"
      ? Number.isInteger(slot.dayOfWeek) && (slot.dayOfWeek as number) >= 0 && (slot.dayOfWeek as number) <= 6 && slot.date === null
      : slot.dayOfWeek === null && isDateKey(slot.date);
  }) || !hasUniqueIds(slots as { id: string }[])) return false;
  if (!activities.every((activity) => activeSlotsAreCompatible(activity as StoredWeeklyActivity, slots as StoredSlot[]))) return false;
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  const sessions = value.sessions;
  if (!sessions.every((session) => {
    if (!isRecord(session) || !isId(session.id) || !isId(session.activityId) || !isId(session.slotId) || !isDateKey(session.date) || !isInstant(session.startsAt) || !isInstant(session.endsAt) || !isCapacity(session.capacity) || typeof session.cancelled !== "boolean") return false;
    const slot = slotById.get(session.slotId);
    const activity = activityById.get(session.activityId);
    if (!slot || !activity || slot.activityId !== session.activityId) return false;
    // Session date, times, and capacity are historical snapshots. Slot or activity
    // edits must not invalidate an otherwise valid persisted session history.
    const startsAt = new Date(session.startsAt);
    const endsAt = new Date(session.endsAt);
    return endsAt.getTime() > startsAt.getTime() && buenosAiresDateKey(startsAt) === session.date;
  }) || !hasUniqueIds(sessions as { id: string }[])) return false;
  if (new Set(sessions.map((session) => `${session.slotId}:${session.date}`)).size !== sessions.length) return false;
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  const enrollments = value.enrollments;
  if (!enrollments.every((enrollment) => {
    if (!isRecord(enrollment) || !isId(enrollment.id) || !isId(enrollment.slotId) || !isId(enrollment.studentId) || (enrollment.status !== "ACTIVE" && enrollment.status !== "CANCELLED")) return false;
    const slot = slotById.get(enrollment.slotId);
    const student = actorById.get(enrollment.studentId);
    if (!slot || !student || student.role !== "STUDENT") return false;
    const activity = activityById.get(slot.activityId)!;
    if (activity.scheduleKind !== "WEEKLY" || !activity.allowsRecurring) return false;
    return enrollment.status === "ACTIVE" ? enrollment.cancelledAt === null : isInstant(enrollment.cancelledAt);
  }) || !hasUniqueIds(enrollments as { id: string }[])) return false;
  if (new Set(enrollments.map((enrollment) => `${enrollment.slotId}:${enrollment.studentId}`)).size !== enrollments.length) return false;
  const enrollmentById = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment]));

  const bookings = value.bookings;
  if (!bookings.every((booking) => {
    if (!isRecord(booking) || !isId(booking.id) || !isId(booking.sessionId) || !isId(booking.studentId) || (booking.source !== "SINGLE" && booking.source !== "ENROLLMENT") || (booking.status !== "CONFIRMED" && booking.status !== "CANCELLED") || typeof booking.addedByStaff !== "boolean") return false;
    const session = sessionById.get(booking.sessionId);
    const student = actorById.get(booking.studentId);
    if (!session || !student || student.role !== "STUDENT" || (booking.status === "CONFIRMED" && session.cancelled)) return false;
    if (booking.status === "CONFIRMED" ? booking.cancelledAt !== null : !isInstant(booking.cancelledAt)) return false;
    if (booking.source === "SINGLE") return booking.enrollmentId === null;
    if (!isId(booking.enrollmentId)) return false;
    const enrollment = enrollmentById.get(booking.enrollmentId);
    return !!enrollment && enrollment.studentId === booking.studentId && enrollment.slotId === session.slotId;
  }) || !hasUniqueIds(bookings as { id: string }[])) return false;
  if (new Set(bookings.map((booking) => `${booking.sessionId}:${booking.studentId}`)).size !== bookings.length) return false;

  for (const session of sessions) {
    const count = bookings.filter((booking) => booking.sessionId === session.id && booking.status === "CONFIRMED").length;
    if (session.capacity !== null && count > session.capacity) return false;
  }
  return true;
}

export function serializeManagementDemoState(state: ManagementDemoState): string {
  if (!isValidManagementDemoState(state)) throw new Error("Cannot serialize an invalid management demo state.");
  return JSON.stringify(state);
}

/** Unknown versions and malformed graphs deliberately reset to deterministic fixtures. */
export function restoreManagementDemoState(
  raw: string | null | undefined,
  fallbackAnchorDate: string,
  now?: Date,
): ManagementDemoState {
  try {
    if (!raw) return createManagementDemoState(fallbackAnchorDate, now);
    const parsed: unknown = JSON.parse(raw);
    return isValidManagementDemoState(parsed) ? parsed : createManagementDemoState(fallbackAnchorDate, now);
  } catch {
    return createManagementDemoState(fallbackAnchorDate, now);
  }
}
