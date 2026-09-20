import type { MyBookingRow, MyEnrollmentRow, StudentSessionRow } from "../../activity/views/view-models";

export const DEMO_STORAGE_KEY = "wody-box-booking-demo-v1";
export const DEMO_STATE_VERSION = 1;
export const DEMO_TIMEZONE = "America/Argentina/Buenos_Aires";

export type DemoAccountKind = "FULL" | "LITE";
type BookingSource = "SINGLE" | "ENROLLMENT";

type DemoBooking = { id: string; source: BookingSource };

export type DemoSession = Omit<StudentSessionRow, "bookingId" | "enrolledSlot"> & {
  cancelWindowHours: number;
  booking: DemoBooking | null;
};

export type DemoEnrollment = MyEnrollmentRow & { slotId: string };

export type DemoBookingState = {
  version: typeof DEMO_STATE_VERSION;
  anchorDate: string;
  accountKind: DemoAccountKind;
  student: { name: string; email: string };
  sessions: DemoSession[];
  enrollments: DemoEnrollment[];
};

export type DemoActionResult =
  | { success: true; bookingId?: string; enrollmentId?: string; bookingsCreated?: number }
  | { success: false; error: string };

export type DemoCommand =
  | { type: "set-account-kind"; accountKind: DemoAccountKind }
  | { type: "book-single"; sessionId: string }
  | { type: "enroll-slot"; slotId: string }
  | { type: "cancel-booking"; bookingId: string }
  | { type: "cancel-enrollment"; enrollmentId: string };

export type DemoTransition = { state: DemoBookingState; result: DemoActionResult };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function nextDay(date: string, dayOfWeek: number): string {
  const current = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addDays(date, (dayOfWeek - current + 7) % 7);
}

function argentinaTime(date: string, hour: number, minute = 0): string {
  // Argentina is UTC-3 without daylight-saving changes. Date-only values stay UTC.
  return `${date}T${String(hour + 3).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

function session(
  id: string,
  slotId: string,
  activityName: string,
  date: string,
  dayOfWeek: number | null,
  startsAtHour: number,
  endsAtHour: number,
  capacity: number | null,
  bookedCount: number,
  allowsRecurring: boolean,
  cancelWindowHours: number,
  booking: DemoBooking | null = null
): DemoSession {
  return {
    id,
    slotId,
    dayOfWeek,
    activityName,
    allowsRecurring,
    date,
    startsAt: argentinaTime(date, startsAtHour),
    endsAt: argentinaTime(date, endsAtHour),
    capacity,
    bookedCount,
    cancelled: false,
    booking,
    cancelWindowHours,
  };
}

/** Fixtures are deterministic for an explicit Buenos Aires calendar day. */
export function createDemoState(anchorDate: string): DemoBookingState {
  if (!datePattern.test(anchorDate)) throw new Error("Demo anchor date must be YYYY-MM-DD.");
  const wednesday = nextDay(anchorDate, 3);
  const saturday = nextDay(anchorDate, 6);
  const friday = nextDay(anchorDate, 5);

  return {
    version: DEMO_STATE_VERSION,
    anchorDate,
    accountKind: "FULL",
    student: { name: "Julia Acosta", email: "julia.acosta.demo@example.test" },
    sessions: [
      session("session-strength-1", "slot-strength-wed", "Fuerza", wednesday, 3, 18, 19, 12, 7, true, 4),
      session("session-strength-2", "slot-strength-wed", "Fuerza", addDays(wednesday, 7), 3, 18, 19, 12, 5, true, 4),
      session("session-strength-3", "slot-strength-wed", "Fuerza", addDays(wednesday, 14), 3, 18, 19, 12, 4, true, 4),
      session("session-open-box", "slot-open-box", "Open Box", friday, 5, 19, 20, null, 3, false, 2, {
        id: "booking-open-box",
        source: "SINGLE",
      }),
      session("session-handstand", "slot-handstand", "Técnica de handstand", addDays(saturday, 1), null, 11, 12, 6, 2, false, 2),
      session("session-mobility-full", "slot-mobility", "Movilidad", saturday, null, 10, 11, 8, 8, false, 2),
    ],
    enrollments: [],
  };
}

export function getArgentinaDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEMO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (kind: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === kind)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function toCalendarSessions(state: DemoBookingState, now = new Date()): StudentSessionRow[] {
  const enrolledSlotIds = new Set(state.enrollments.map((enrollment) => enrollment.slotId));
  return state.sessions
    .filter((session) => new Date(session.startsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((session) => ({
      id: session.id,
      slotId: session.slotId,
      dayOfWeek: session.dayOfWeek,
      activityName: session.activityName,
      allowsRecurring: session.allowsRecurring,
      date: session.date,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      capacity: session.capacity,
      bookedCount: session.bookedCount,
      cancelled: session.cancelled,
      bookingId: session.booking?.id ?? null,
      enrolledSlot: enrolledSlotIds.has(session.slotId),
    }));
}

export function toMyBookingRows(state: DemoBookingState, now = new Date()): MyBookingRow[] {
  return state.sessions
    .filter((session) => session.booking !== null && !session.cancelled && new Date(session.startsAt) >= now)
    .map((session) => ({
      bookingId: session.booking!.id,
      activityName: session.activityName,
      date: session.date,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function cannotBook(state: DemoBookingState): DemoActionResult | null {
  return state.accountKind === "LITE"
    ? { success: false, error: "Tu cuenta LITE no puede reservar turnos por sí misma. Pedile al profe que te anote." }
    : null;
}

function cancelBooking(state: DemoBookingState, bookingId: string, now: Date): DemoTransition {
  const target = state.sessions.find((candidate) => candidate.booking?.id === bookingId);
  if (!target || !target.booking) return { state, result: { success: false, error: "Reserva no encontrada." } };
  if (new Date(target.startsAt).getTime() - now.getTime() < target.cancelWindowHours * 60 * 60 * 1000) {
    return {
      state,
      result: { success: false, error: `Ya no se puede cancelar: hay que hacerlo con al menos ${target.cancelWindowHours}hs de anticipación.` },
    };
  }
  return {
    state: {
      ...state,
      sessions: state.sessions.map((candidate) =>
        candidate.id === target.id
          ? { ...candidate, booking: null, bookedCount: Math.max(0, candidate.bookedCount - 1) }
          : candidate
      ),
    },
    result: { success: true },
  };
}

export function reduceDemoBooking(state: DemoBookingState, command: DemoCommand, now = new Date()): DemoTransition {
  if (command.type === "set-account-kind") {
    return { state: { ...state, accountKind: command.accountKind }, result: { success: true } };
  }

  if (command.type === "cancel-booking") return cancelBooking(state, command.bookingId, now);

  if (command.type === "book-single") {
    const blocked = cannotBook(state);
    if (blocked) return { state, result: blocked };
    const target = state.sessions.find((candidate) => candidate.id === command.sessionId);
    if (!target || target.cancelled || new Date(target.startsAt) < now) {
      return { state, result: { success: false, error: "Esta sesión ya no está disponible." } };
    }
    if (target.booking) return { state, result: { success: false, error: "Ya estás anotado en esta sesión." } };
    if (target.capacity !== null && target.bookedCount >= target.capacity) {
      return { state, result: { success: false, error: "No hay cupo disponible en esta sesión." } };
    }
    const bookingId = `booking-${target.id}`;
    return {
      state: {
        ...state,
        sessions: state.sessions.map((candidate) =>
          candidate.id === target.id
            ? { ...candidate, booking: { id: bookingId, source: "SINGLE" }, bookedCount: candidate.bookedCount + 1 }
            : candidate
        ),
      },
      result: { success: true, bookingId },
    };
  }

  if (command.type === "enroll-slot") {
    const blocked = cannotBook(state);
    if (blocked) return { state, result: blocked };
    const slotSessions = state.sessions.filter((candidate) => candidate.slotId === command.slotId);
    if (slotSessions.length === 0 || !slotSessions[0].allowsRecurring) {
      return { state, result: { success: false, error: "Esta actividad no admite inscripción recurrente." } };
    }
    if (state.enrollments.some((enrollment) => enrollment.slotId === command.slotId)) {
      return { state, result: { success: false, error: "Ya estás inscripto a este horario." } };
    }

    const enrollmentId = `enrollment-${command.slotId}`;
    const futureSessions = new Set(
      slotSessions
        .filter((candidate) => new Date(candidate.startsAt) > now && !candidate.cancelled && candidate.booking === null)
        .filter((candidate) => candidate.capacity === null || candidate.bookedCount < candidate.capacity)
        .map((candidate) => candidate.id)
    );
    const template = slotSessions[0];
    return {
      state: {
        ...state,
        enrollments: [
          ...state.enrollments,
          {
            enrollmentId,
            slotId: command.slotId,
            activityName: template.activityName,
            dayOfWeek: template.dayOfWeek,
            startMinute: 18 * 60,
            endMinute: 19 * 60,
          },
        ],
        sessions: state.sessions.map((candidate) =>
          futureSessions.has(candidate.id)
            ? {
                ...candidate,
                booking: { id: `booking-${enrollmentId}-${candidate.id}`, source: "ENROLLMENT" },
                bookedCount: candidate.bookedCount + 1,
              }
            : candidate
        ),
      },
      result: { success: true, enrollmentId, bookingsCreated: futureSessions.size },
    };
  }

  const enrollment = state.enrollments.find((candidate) => candidate.enrollmentId === command.enrollmentId);
  if (!enrollment) return { state, result: { success: false, error: "Inscripción no encontrada." } };
  return {
    state: {
      ...state,
      enrollments: state.enrollments.filter((candidate) => candidate.enrollmentId !== enrollment.enrollmentId),
      sessions: state.sessions.map((candidate) => {
        const removesFutureDerivedBooking =
          candidate.slotId === enrollment.slotId &&
          candidate.booking?.source === "ENROLLMENT" &&
          new Date(candidate.startsAt) > now;
        return removesFutureDerivedBooking
          ? { ...candidate, booking: null, bookedCount: Math.max(0, candidate.bookedCount - 1) }
          : candidate;
      }),
    },
    result: { success: true },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !instantPattern.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isDayOfWeek(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6);
}

function isMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 24 * 60;
}

function isStoredBooking(value: unknown): value is DemoBooking | null {
  return value === null || (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    (value.source === "SINGLE" || value.source === "ENROLLMENT")
  );
}

function isStoredSession(value: unknown): value is DemoSession {
  if (!isRecord(value)) return false;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.slotId) ||
    !isNonEmptyString(value.activityName) ||
    !isDateKey(value.date) ||
    !isDayOfWeek(value.dayOfWeek) ||
    typeof value.allowsRecurring !== "boolean" ||
    !isIsoInstant(value.startsAt) ||
    !isIsoInstant(value.endsAt) ||
    typeof value.cancelled !== "boolean" ||
    !isStoredBooking(value.booking)
  ) return false;

  const startsAt = new Date(value.startsAt).getTime();
  const endsAt = new Date(value.endsAt).getTime();
  if (endsAt <= startsAt) return false;
  const capacity = value.capacity;
  const bookedCount = value.bookedCount;
  const cancelWindowHours = value.cancelWindowHours;
  if (capacity !== null && (typeof capacity !== "number" || !Number.isSafeInteger(capacity) || capacity < 0)) return false;
  if (typeof bookedCount !== "number" || !Number.isSafeInteger(bookedCount) || bookedCount < 0) return false;
  if (typeof capacity === "number" && bookedCount > capacity) return false;
  return typeof cancelWindowHours === "number" && Number.isSafeInteger(cancelWindowHours) && cancelWindowHours >= 0;
}

function isStoredEnrollment(value: unknown, slotIds: Set<string>): value is DemoEnrollment {
  return (
    isRecord(value) &&
    isNonEmptyString(value.enrollmentId) &&
    isNonEmptyString(value.slotId) &&
    slotIds.has(value.slotId) &&
    isNonEmptyString(value.activityName) &&
    isDayOfWeek(value.dayOfWeek) &&
    isMinute(value.startMinute) &&
    isMinute(value.endMinute) &&
    value.endMinute > value.startMinute
  );
}

function isStoredState(value: unknown): value is DemoBookingState {
  if (!isRecord(value) || value.version !== DEMO_STATE_VERSION || !isDateKey(value.anchorDate)) return false;
  if (value.accountKind !== "FULL" && value.accountKind !== "LITE") return false;
  if (!isRecord(value.student) || !isNonEmptyString(value.student.name) || !isNonEmptyString(value.student.email)) return false;
  if (!Array.isArray(value.sessions) || !value.sessions.every(isStoredSession) || !Array.isArray(value.enrollments)) return false;

  const sessionIds = new Set(value.sessions.map((session) => session.id));
  const slotIds = new Set(value.sessions.map((session) => session.slotId));
  const bookingIds = value.sessions.flatMap((session) => session.booking ? [session.booking.id] : []);
  if (sessionIds.size !== value.sessions.length || new Set(bookingIds).size !== bookingIds.length) return false;
  if (!value.enrollments.every((enrollment) => isStoredEnrollment(enrollment, slotIds))) return false;
  const enrollmentIds = new Set(value.enrollments.map((enrollment) => enrollment.enrollmentId));
  const enrollmentSlotIds = new Set(value.enrollments.map((enrollment) => enrollment.slotId));
  return enrollmentIds.size === value.enrollments.length && enrollmentSlotIds.size === value.enrollments.length;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function loadDemoState(storage: StorageLike, fallbackAnchorDate: string): DemoBookingState {
  try {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return createDemoState(fallbackAnchorDate);
    const parsed: unknown = JSON.parse(raw);
    return isStoredState(parsed) ? parsed : createDemoState(fallbackAnchorDate);
  } catch {
    return createDemoState(fallbackAnchorDate);
  }
}

export function saveDemoState(storage: StorageLike, state: DemoBookingState): boolean {
  try {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function resetDemoState(storage: StorageLike, anchorDate: string): DemoBookingState {
  try {
    storage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // Storage can be blocked in privacy modes; the in-memory reset still works.
  }
  return createDemoState(anchorDate);
}
