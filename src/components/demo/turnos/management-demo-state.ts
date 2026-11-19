import type {
  EnrollmentBookingRow,
  MyBookingRow,
  MyEnrollmentRow,
  SessionRow,
  SlotInput,
  SlotRow,
  StudentOption,
  StudentSessionRow,
} from "../../activity/views/view-models";
import type { ActivityListRow } from "../../activity/ActivityList";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { addCalendarDays, buenosAiresDateKey, buenosAiresInstant, createManagementDemoFixture, dayOfWeek } from "./management-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { MANAGEMENT_DEMO_VERSION } from "./management-demo-types.ts";
import type {
  DemoActor,
  ManagementActivityInput,
  ManagementActivityResult,
  ManagementBookingResult,
  ManagementDeletionPreview,
  ManagementDeletionResult,
  ManagementDemoCommand,
  ManagementDemoState,
  ManagementEnrollmentResult,
  ManagementProjection,
  ManagementResult,
  ManagementSlotResult,
  ManagementTransition,
  MaterializeResult,
  ManagedBooking,
  ManagedEnrollment,
  ManagedSession,
  ManagedSlot,
} from "./management-demo-types";

export { MANAGEMENT_DEMO_VERSION };
export type {
  DemoActor,
  ManagementActivityInput,
  ManagementDemoCommand,
  ManagementDemoState,
  ManagedBooking,
  ManagedEnrollment,
  ManagedSession,
  ManagedSlot,
} from "./management-demo-types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_MS = 60 * 60 * 1000;

function transition<R>(state: ManagementDemoState, result: R): ManagementTransition<R> {
  return { state, result };
}

function failure<T extends { success: false; error: string }>(
  state: ManagementDemoState,
  error: string,
): ManagementTransition<T> {
  return transition(state, { success: false, error } as T);
}

function currentActor(state: ManagementDemoState): DemoActor | undefined {
  return state.actors.find((actor) => actor.id === state.activeActorId);
}

function activityById(state: ManagementDemoState, activityId: string) {
  return state.activities.find((activity) => activity.id === activityId);
}

function slotById(state: ManagementDemoState, slotId: string) {
  return state.slots.find((slot) => slot.id === slotId);
}

function sessionById(state: ManagementDemoState, sessionId: string) {
  return state.sessions.find((session) => session.id === sessionId);
}

function studentById(state: ManagementDemoState, studentId: string) {
  const actor = state.actors.find((candidate) => candidate.id === studentId);
  return actor?.role === "STUDENT" ? actor : undefined;
}

function ownsActivity(state: ManagementDemoState, activityId: string): boolean {
  const actor = currentActor(state);
  const activity = activityById(state, activityId);
  return !!activity && !!actor && (actor.role === "ADMIN" || (actor.role === "TEACHER" && activity.teacherId === actor.id));
}

function uniqueId(existing: readonly { id: string }[], prefix: string): string {
  let suffix = 1;
  const ids = new Set(existing.map((value) => value.id));
  while (ids.has(`${prefix}-${suffix}`)) suffix += 1;
  return `${prefix}-${suffix}`;
}

function isDateKey(value: string | null): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isPositiveCapacity(value: number | null): boolean {
  return value === null || (Number.isSafeInteger(value) && value > 0);
}

function validateSlot(input: SlotInput, scheduleKind: "WEEKLY" | "ONE_OFF"): string | null {
  if (scheduleKind === "WEEKLY") {
    if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek === null || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      return "El día de la semana no es válido.";
    }
    if (input.date !== null) return "Un horario semanal no debe tener fecha.";
  } else {
    if (input.dayOfWeek !== null) return "Un horario de fecha única no debe tener día de la semana.";
    if (!isDateKey(input.date)) return "La fecha no es válida.";
  }
  if (!Number.isInteger(input.startMinute) || input.startMinute < 0 || input.startMinute >= 1440) {
    return "La hora de inicio no es válida.";
  }
  if (!Number.isInteger(input.endMinute) || input.endMinute <= input.startMinute || input.endMinute > 1440) {
    return "La hora de fin debe ser posterior a la de inicio.";
  }
  if (!isPositiveCapacity(input.capacity)) return "El cupo debe ser un número entero positivo, o vacío para sin límite.";
  return null;
}

function slotsOverlap(left: SlotInput, right: SlotInput): boolean {
  const sameDate = left.date !== null && left.date === right.date;
  const sameDay = left.dayOfWeek !== null && left.dayOfWeek === right.dayOfWeek;
  return (sameDate || sameDay) && left.startMinute < right.endMinute && right.startMinute < left.endMinute;
}

function validateSlots(slots: SlotInput[], scheduleKind: "WEEKLY" | "ONE_OFF"): string | null {
  if (slots.length === 0) return "Agregá al menos un horario.";
  for (const slot of slots) {
    const error = validateSlot(slot, scheduleKind);
    if (error) return error;
  }
  for (let index = 0; index < slots.length; index += 1) {
    for (let other = index + 1; other < slots.length; other += 1) {
      if (slotsOverlap(slots[index], slots[other])) return "Hay horarios superpuestos el mismo día.";
    }
  }
  return null;
}

function validateActivityInput(input: ManagementActivityInput): string | null {
  if (!input.name.trim()) return "El nombre es obligatorio.";
  if (input.scheduleKind !== "WEEKLY" && input.scheduleKind !== "ONE_OFF") return "Modo de agenda inválido.";
  if (!Number.isSafeInteger(input.cancelWindowHours) || input.cancelWindowHours < 0) {
    return "La ventana de cancelación debe ser un número mayor o igual a cero.";
  }
  if (!isPositiveCapacity(input.capacity)) return "El cupo debe ser un número entero positivo, o vacío para sin límite.";
  if (input.scheduleKind === "WEEKLY") {
    if (!isDateKey(input.startsOn)) return "La fecha de inicio de vigencia no es válida.";
    if (input.endsOn !== null && !isDateKey(input.endsOn)) return "La fecha de fin de vigencia no es válida.";
    if (input.endsOn && input.endsOn < input.startsOn) return "La fecha de fin de vigencia debe ser posterior o igual a la de inicio.";
  } else if (input.startsOn !== null || input.endsOn !== null) {
    return "Las actividades de fecha única no tienen vigencia semanal.";
  }
  return null;
}

function startsOnMatchesSlots(startsOn: string, slots: readonly SlotInput[]): boolean {
  return slots.some((slot) => slot.dayOfWeek === dayOfWeek(startsOn));
}

function confirmedBookings(state: ManagementDemoState, sessionId: string): ManagedBooking[] {
  return state.bookings.filter((booking) => booking.sessionId === sessionId && booking.status === "CONFIRMED");
}

function bookedCount(state: ManagementDemoState, sessionId: string): number {
  return confirmedBookings(state, sessionId).length;
}

function sessionIsPast(session: ManagedSession, now: Date): boolean {
  return new Date(session.startsAt).getTime() <= now.getTime();
}

function sessionCapacity(activity: { capacity: number | null }, slot: ManagedSlot): number | null {
  return slot.capacity ?? activity.capacity;
}

function cancelBookingsForSession(
  state: ManagementDemoState,
  sessionId: string,
  now: Date,
): ManagedBooking[] {
  const cancelledAt = now.toISOString();
  return state.bookings.map((booking) =>
    booking.sessionId === sessionId && booking.status === "CONFIRMED"
      ? { ...booking, status: "CANCELLED", cancelledAt }
      : booking,
  );
}

function canStudentAct(state: ManagementDemoState, studentId: string): DemoActor | undefined {
  const actor = currentActor(state);
  if (!actor || actor.role !== "STUDENT" || actor.id !== studentId || actor.accountKind !== "FULL") return undefined;
  return actor;
}

function upsertBooking(
  state: ManagementDemoState,
  sessionId: string,
  studentId: string,
  source: "SINGLE" | "ENROLLMENT",
  enrollmentId: string | null,
  addedByStaff: boolean,
): { bookings: ManagedBooking[]; bookingId: string } {
  const existing = state.bookings.find((booking) => booking.sessionId === sessionId && booking.studentId === studentId);
  if (existing) {
    return {
      bookingId: existing.id,
      bookings: state.bookings.map((booking) =>
        booking.id === existing.id
          ? { ...booking, source, enrollmentId, status: "CONFIRMED", addedByStaff, cancelledAt: null }
          : booking,
      ),
    };
  }
  const id = uniqueId(state.bookings, "booking");
  return {
    bookingId: id,
    bookings: [
      ...state.bookings,
      { id, sessionId, studentId, source, enrollmentId, status: "CONFIRMED", addedByStaff, cancelledAt: null },
    ],
  };
}

/** A deterministic, fully normalized fixture. It does not read storage or the clock. */
export function createManagementDemoState(anchorDate: string, _now?: Date): ManagementDemoState {
  void _now;
  return createManagementDemoFixture(anchorDate);
}

export function selectManagementDemoActor(
  state: ManagementDemoState,
  actorId: string,
): ManagementTransition<ManagementResult> {
  if (!state.actors.some((actor) => actor.id === actorId)) return failure(state, "Actor no encontrado.");
  return transition({ ...state, activeActorId: actorId }, { success: true });
}

export function createManagedActivity(
  state: ManagementDemoState,
  input: ManagementActivityInput,
  slotInputs: SlotInput[],
  now: Date,
): ManagementTransition<ManagementActivityResult> {
  const actor = currentActor(state);
  if (!actor || (actor.role !== "ADMIN" && actor.role !== "TEACHER")) return failure(state, "No autorizado.");
  const inputError = validateActivityInput(input);
  if (inputError) return failure(state, inputError);
  const slotsError = validateSlots(slotInputs, input.scheduleKind);
  if (slotsError) return failure(state, slotsError);
  if (input.scheduleKind === "WEEKLY" && !startsOnMatchesSlots(input.startsOn!, slotInputs)) {
    return failure(state, "La fecha de inicio debe caer en uno de los días con horario cargado.");
  }
  let teacherId = input.teacherId;
  if (actor.role === "TEACHER") teacherId = actor.id;
  if (teacherId !== null && !state.actors.some((candidate) => candidate.id === teacherId && candidate.role === "TEACHER")) {
    return failure(state, "Profe no encontrado.");
  }
  const teacher = teacherId ? state.actors.find((candidate) => candidate.id === teacherId) : undefined;
  const activityId = uniqueId(state.activities, "activity");
  const activity = {
    ...input,
    id: activityId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    teacherId,
    teacherName: teacher?.name ?? null,
    active: true,
  };
  const slots: ManagedSlot[] = slotInputs.map((inputSlot, index) => ({
    ...inputSlot,
    id: `${activityId}-slot-${index + 1}`,
    activityId,
    active: true,
  }));
  const created = { ...state, activities: [...state.activities, activity], slots: [...state.slots, ...slots] };
  const materialized = materializeUpcomingSessions(created, now);
  return transition(materialized.state, { success: true, activity });
}

export function updateManagedActivity(
  state: ManagementDemoState,
  activityId: string,
  input: ManagementActivityInput,
  now = new Date(`${state.anchorDate}T12:00:00.000Z`),
): ManagementTransition<ManagementActivityResult> {
  const existing = activityById(state, activityId);
  if (!existing) return failure(state, "Actividad no encontrada.");
  if (!ownsActivity(state, activityId)) return failure(state, "No autorizado.");
  if (input.scheduleKind !== existing.scheduleKind) return failure(state, "No se puede cambiar el modo de agenda de una actividad existente.");
  const inputError = validateActivityInput(input);
  if (inputError) return failure(state, inputError);
  const actor = currentActor(state)!;
  if (actor.role === "TEACHER" && input.teacherId !== existing.teacherId) return failure(state, "No autorizado.");
  const teacherId = actor.role === "TEACHER" ? actor.id : input.teacherId;
  if (teacherId !== null && !state.actors.some((candidate) => candidate.id === teacherId && candidate.role === "TEACHER")) {
    return failure(state, "Profe no encontrado.");
  }
  const activeSlots = state.slots.filter((slot) => slot.activityId === activityId && slot.active);
  if (input.scheduleKind === "WEEKLY" && !startsOnMatchesSlots(input.startsOn!, activeSlots)) {
    return failure(state, "La fecha de inicio debe caer en uno de los días con horario cargado.");
  }
  const teacher = teacherId ? state.actors.find((candidate) => candidate.id === teacherId) : undefined;
  const activity = {
    ...existing,
    ...input,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    teacherId,
    teacherName: teacher?.name ?? null,
    scheduleKind: existing.scheduleKind,
  };
  let next: ManagementDemoState = {
    ...state,
    activities: state.activities.map((candidate) => (candidate.id === activityId ? activity : candidate)),
  };
  if (activity.scheduleKind === "WEEKLY") {
    const outsideWindow = next.sessions.filter(
      (session) =>
        session.activityId === activityId &&
        !session.cancelled &&
        new Date(session.startsAt).getTime() > now.getTime() &&
        ((activity.startsOn !== null && session.date < activity.startsOn) ||
          (activity.endsOn !== null && session.date > activity.endsOn)),
    );
    for (const session of outsideWindow) {
      next = {
        ...next,
        sessions: next.sessions.map((candidate) =>
          candidate.id === session.id ? { ...candidate, cancelled: true } : candidate,
        ),
        bookings: cancelBookingsForSession(next, session.id, now),
      };
    }
  }
  return transition(next, { success: true, activity });
}

export function manageSlot(
  state: ManagementDemoState,
  activityId: string,
  input: SlotInput,
  slotId?: string,
  now = new Date(`${state.anchorDate}T12:00:00.000Z`),
): ManagementTransition<ManagementSlotResult> {
  const activity = activityById(state, activityId);
  if (!activity) return failure(state, "Actividad no encontrada.");
  if (!ownsActivity(state, activityId)) return failure(state, "No autorizado.");
  const target = slotId ? state.slots.find((slot) => slot.id === slotId && slot.activityId === activityId) : undefined;
  if (slotId && !target) return failure(state, "Horario no encontrado.");
  const validationError = validateSlot(input, activity.scheduleKind);
  if (validationError) return failure(state, validationError);
  const otherSlots = state.slots.filter((slot) => slot.activityId === activityId && slot.active && slot.id !== slotId);
  if (otherSlots.some((slot) => slotsOverlap(slot, input))) return failure(state, "Hay horarios superpuestos el mismo día.");
  const candidateSlots = [...otherSlots, input];
  if (activity.scheduleKind === "WEEKLY" && !startsOnMatchesSlots(activity.startsOn!, candidateSlots)) {
    return failure(state, "Este cambio dejaría la fecha de inicio de la actividad sin ningún horario ese día.");
  }
  const slot: ManagedSlot = { ...input, id: target?.id ?? uniqueId(state.slots, `${activityId}-slot`), activityId, active: target?.active ?? true };
  const next = {
    ...state,
    slots: target ? state.slots.map((candidate) => (candidate.id === target.id ? slot : candidate)) : [...state.slots, slot],
  };
  // A newly created slot is immediately visible in management, like the production action.
  // Editing deliberately leaves existing session snapshots and history untouched.
  const materialized = target ? null : materializeUpcomingSessions(next, now);
  return transition(materialized?.state ?? next, { success: true, slot: toSlotRow(slot) });
}

export function deactivateManagedSlot(
  state: ManagementDemoState,
  activityId: string,
  slotId: string,
): ManagementTransition<ManagementResult> {
  const activity = activityById(state, activityId);
  const slot = state.slots.find((candidate) => candidate.id === slotId && candidate.activityId === activityId);
  if (!activity || !slot) return failure(state, "Horario no encontrado.");
  if (!ownsActivity(state, activityId)) return failure(state, "No autorizado.");
  const remaining = state.slots.filter((candidate) => candidate.activityId === activityId && candidate.active && candidate.id !== slotId);
  if (activity.scheduleKind === "WEEKLY" && !startsOnMatchesSlots(activity.startsOn!, remaining)) {
    return failure(state, "No se puede desactivar: dejaría la fecha de inicio de la actividad sin ningún horario ese día.");
  }
  return transition(
    { ...state, slots: state.slots.map((candidate) => (candidate.id === slotId ? { ...candidate, active: false } : candidate)) },
    { success: true },
  );
}

function datesForSlot(slot: ManagedSlot, activity: { scheduleKind: string; startsOn: string | null; endsOn: string | null }, firstDate: string): string[] {
  if (activity.scheduleKind === "ONE_OFF") return slot.date ? [slot.date] : [];
  const dates: string[] = [];
  for (let offset = 0; offset < 28; offset += 1) {
    const date = addCalendarDays(firstDate, offset);
    if (
      slot.dayOfWeek === dayOfWeek(date) &&
      (activity.startsOn === null || date >= activity.startsOn) &&
      (activity.endsOn === null || date <= activity.endsOn)
    ) {
      dates.push(date);
    }
  }
  return dates;
}

// Rolling-window materialization preserves every student's opt-out (any existing booking row,
// cancelled or not, is left alone); explicit enrollment revives a previously cancelled booking, but
// only for the enrollment that is being (re-)activated — every other student's opt-out is preserved.
function materializeEnrollmentBookings(
  state: ManagementDemoState,
  sessionIds: readonly string[],
  revivingEnrollmentId: string | null,
): { state: ManagementDemoState; bookingsCreated: number } {
  let next = state;
  let bookingsCreated = 0;
  for (const enrollment of next.enrollments.filter((candidate) => candidate.status === "ACTIVE")) {
    for (const sessionId of sessionIds) {
      const session = sessionById(next, sessionId);
      if (!session || session.cancelled || session.slotId !== enrollment.slotId) continue;
      const existingBooking = next.bookings.find(
        (booking) => booking.sessionId === sessionId && booking.studentId === enrollment.studentId,
      );
      const mayRevive = revivingEnrollmentId !== null && enrollment.id === revivingEnrollmentId;
      if (existingBooking && (!mayRevive || existingBooking.status !== "CANCELLED")) continue;
      if (session.capacity !== null && bookedCount(next, sessionId) >= session.capacity) continue;
      const booked = upsertBooking(next, sessionId, enrollment.studentId, "ENROLLMENT", enrollment.id, false);
      next = { ...next, bookings: booked.bookings };
      bookingsCreated += 1;
    }
  }
  return { state: next, bookingsCreated };
}

/** Materializes a bounded 28-day window from injected time; repeated calls never duplicate sessions. */
export function materializeUpcomingSessions(
  state: ManagementDemoState,
  now: Date,
): ManagementTransition<MaterializeResult> {
  const firstDate = buenosAiresDateKey(now);
  const additions: ManagedSession[] = [];
  for (const slot of state.slots.filter((candidate) => candidate.active)) {
    const activity = activityById(state, slot.activityId);
    if (!activity || !activity.active) continue;
    for (const date of datesForSlot(slot, activity, firstDate)) {
      if (date < firstDate || date >= addCalendarDays(firstDate, 28)) continue;
      if (state.sessions.some((session) => session.slotId === slot.id && session.date === date)) continue;
      additions.push({
        id: `session-${slot.id}-${date}`,
        activityId: activity.id,
        slotId: slot.id,
        date,
        startsAt: buenosAiresInstant(date, slot.startMinute),
        endsAt: buenosAiresInstant(date, slot.endMinute),
        capacity: sessionCapacity(activity, slot),
        cancelled: false,
      });
    }
  }
  const withSessions = additions.length === 0 ? state : { ...state, sessions: [...state.sessions, ...additions] };
  const enrolled = materializeEnrollmentBookings(withSessions, additions.map((session) => session.id), null);
  return transition(enrolled.state, { success: true, sessionsCreated: additions.length, bookingsCreated: enrolled.bookingsCreated });
}

export function cancelManagedSession(
  state: ManagementDemoState,
  sessionId: string,
  now: Date,
): ManagementTransition<ManagementResult> {
  const session = sessionById(state, sessionId);
  if (!session) return failure(state, "Sesión no encontrada.");
  if (!ownsActivity(state, session.activityId)) return failure(state, "No autorizado.");
  if (session.cancelled) return failure(state, "La sesión ya está cancelada.");
  return transition(
    {
      ...state,
      sessions: state.sessions.map((candidate) => (candidate.id === sessionId ? { ...candidate, cancelled: true } : candidate)),
      bookings: cancelBookingsForSession(state, sessionId, now),
    },
    { success: true },
  );
}

export function manuallyBookStudent(
  state: ManagementDemoState,
  sessionId: string,
  studentId: string,
  now: Date,
): ManagementTransition<ManagementBookingResult> {
  const session = sessionById(state, sessionId);
  const student = studentById(state, studentId);
  if (!session) return failure(state, "Sesión no encontrada.");
  if (!ownsActivity(state, session.activityId)) return failure(state, "No autorizado.");
  if (!student) return failure(state, "Alumno no encontrado.");
  if (sessionIsPast(session, now)) return failure(state, "No se puede anotar en una sesión pasada.");
  if (session.cancelled) return failure(state, "No se puede anotar en una sesión cancelada.");
  const existing = state.bookings.find((booking) => booking.sessionId === sessionId && booking.studentId === studentId);
  if (existing?.status === "CONFIRMED") return failure(state, "El alumno ya está anotado en esta sesión.");
  if (session.capacity !== null && bookedCount(state, sessionId) >= session.capacity) return failure(state, "No hay cupo disponible en esta sesión.");
  const booked = upsertBooking(state, sessionId, studentId, "SINGLE", null, true);
  return transition({ ...state, bookings: booked.bookings }, { success: true, bookingId: booked.bookingId });
}

export function manuallyUnbookStudent(
  state: ManagementDemoState,
  bookingId: string,
  now: Date,
): ManagementTransition<ManagementResult> {
  const booking = state.bookings.find((candidate) => candidate.id === bookingId);
  const session = booking ? sessionById(state, booking.sessionId) : undefined;
  if (!booking || !session) return failure(state, "Reserva no encontrada.");
  if (!ownsActivity(state, session.activityId)) return failure(state, "No autorizado.");
  if (booking.status !== "CONFIRMED") return failure(state, "La reserva ya estaba cancelada.");
  return transition(
    {
      ...state,
      bookings: state.bookings.map((candidate) =>
        candidate.id === bookingId ? { ...candidate, status: "CANCELLED", cancelledAt: now.toISOString() } : candidate,
      ),
    },
    { success: true },
  );
}

export function studentBookSession(
  state: ManagementDemoState,
  studentId: string,
  sessionId: string,
  now: Date,
): ManagementTransition<ManagementBookingResult> {
  if (!canStudentAct(state, studentId)) return failure(state, "Tu cuenta no puede reservar turnos por sí misma. Pedile al profe que te anote.");
  const session = sessionById(state, sessionId);
  if (!session) return failure(state, "Sesión no encontrada.");
  const activity = activityById(state, session.activityId);
  const slot = slotById(state, session.slotId);
  if (!activity || !slot || !activity.active || !slot.active || session.cancelled || sessionIsPast(session, now)) {
    return failure(state, "Esta sesión ya no está disponible.");
  }
  const existing = state.bookings.find((booking) => booking.sessionId === sessionId && booking.studentId === studentId);
  if (existing?.status === "CONFIRMED") return failure(state, "Ya estás anotado en esta sesión.");
  if (session.capacity !== null && bookedCount(state, sessionId) >= session.capacity) return failure(state, "No hay cupo disponible en esta sesión.");
  const booked = upsertBooking(state, sessionId, studentId, "SINGLE", null, false);
  return transition({ ...state, bookings: booked.bookings }, { success: true, bookingId: booked.bookingId });
}

export function studentEnrollInSlot(
  state: ManagementDemoState,
  studentId: string,
  slotId: string,
  now: Date,
): ManagementTransition<ManagementEnrollmentResult> {
  if (!canStudentAct(state, studentId)) return failure(state, "Tu cuenta no puede reservar turnos por sí misma. Pedile al profe que te anote.");
  const slot = slotById(state, slotId);
  const activity = slot ? activityById(state, slot.activityId) : undefined;
  if (!slot || !activity) return failure(state, "Horario no encontrado.");
  if (!slot.active || !activity.active || activity.scheduleKind !== "WEEKLY" || !activity.allowsRecurring) {
    return failure(state, "Esta actividad no admite inscripción recurrente.");
  }
  const existing = state.enrollments.find((enrollment) => enrollment.slotId === slotId && enrollment.studentId === studentId);
  if (existing?.status === "ACTIVE") return failure(state, "Ya estás inscripto a este horario.");
  const enrollmentId = existing?.id ?? uniqueId(state.enrollments, "enrollment");
  const enrollment: ManagedEnrollment = { id: enrollmentId, slotId, studentId, status: "ACTIVE", cancelledAt: null };
  let next = {
    ...state,
    enrollments: existing
      ? state.enrollments.map((candidate) => (candidate.id === existing.id ? enrollment : candidate))
      : [...state.enrollments, enrollment],
  };
  const futureSessions = next.sessions
    .filter((session) => session.slotId === slotId && !session.cancelled && new Date(session.startsAt).getTime() > now.getTime())
    .map((session) => session.id);
  const materialized = materializeEnrollmentBookings(next, futureSessions, enrollmentId);
  next = materialized.state;
  return transition(next, { success: true, enrollmentId, bookingsCreated: materialized.bookingsCreated });
}

export function studentCancelBooking(
  state: ManagementDemoState,
  studentId: string,
  bookingId: string,
  now: Date,
): ManagementTransition<ManagementResult> {
  if (!canStudentAct(state, studentId)) return failure(state, "No autorizado.");
  const booking = state.bookings.find((candidate) => candidate.id === bookingId && candidate.studentId === studentId);
  const session = booking ? sessionById(state, booking.sessionId) : undefined;
  if (!booking || !session) return failure(state, "Reserva no encontrada.");
  if (booking.status !== "CONFIRMED") return failure(state, "La reserva ya estaba cancelada.");
  const activity = activityById(state, session.activityId)!;
  if (new Date(session.startsAt).getTime() - now.getTime() < activity.cancelWindowHours * HOUR_MS) {
    return failure(state, `Ya no se puede cancelar: hay que hacerlo con al menos ${activity.cancelWindowHours}hs de anticipación.`);
  }
  return transition(
    {
      ...state,
      bookings: state.bookings.map((candidate) =>
        candidate.id === bookingId ? { ...candidate, status: "CANCELLED", cancelledAt: now.toISOString() } : candidate,
      ),
    },
    { success: true },
  );
}

export function studentCancelEnrollment(
  state: ManagementDemoState,
  studentId: string,
  enrollmentId: string,
  now: Date,
): ManagementTransition<ManagementResult> {
  if (!canStudentAct(state, studentId)) return failure(state, "No autorizado.");
  const enrollment = state.enrollments.find((candidate) => candidate.id === enrollmentId && candidate.studentId === studentId);
  if (!enrollment) return failure(state, "Inscripción no encontrada.");
  if (enrollment.status !== "ACTIVE") return failure(state, "La inscripción ya estaba cancelada.");
  return transition(
    {
      ...state,
      enrollments: state.enrollments.map((candidate) =>
        candidate.id === enrollmentId ? { ...candidate, status: "CANCELLED", cancelledAt: now.toISOString() } : candidate,
      ),
      bookings: state.bookings.map((booking) => {
        const session = sessionById(state, booking.sessionId);
        return booking.enrollmentId === enrollmentId &&
          booking.status === "CONFIRMED" &&
          session &&
          new Date(session.startsAt).getTime() > now.getTime()
          ? { ...booking, status: "CANCELLED", cancelledAt: now.toISOString() }
          : booking;
      }),
    },
    { success: true },
  );
}

export function previewManagedActivityDeletion(
  state: ManagementDemoState,
  activityId: string,
  now: Date,
): ManagementTransition<ManagementDeletionPreview> {
  const activity = activityById(state, activityId);
  if (!activity) return failure(state, "Actividad no encontrada.");
  if (!ownsActivity(state, activityId)) return failure(state, "No autorizado.");
  const sessionIds = new Set(state.sessions.filter((session) => session.activityId === activityId).map((session) => session.id));
  const willArchive = state.bookings.some((booking) => sessionIds.has(booking.sessionId));
  const futureBookedStudents = willArchive
    ? state.bookings.filter((booking) => {
        const session = sessionById(state, booking.sessionId);
        return booking.status === "CONFIRMED" && !!session && !session.cancelled && sessionIds.has(session.id) && new Date(session.startsAt).getTime() >= now.getTime();
      }).length
    : 0;
  return transition(state, { success: true, willArchive, futureBookedStudents });
}

export function deleteManagedActivity(
  state: ManagementDemoState,
  activityId: string,
  now: Date,
): ManagementTransition<ManagementDeletionResult> {
  const preview = previewManagedActivityDeletion(state, activityId, now);
  if (!preview.result.success) return transition(state, preview.result);
  const sessionIds = new Set(state.sessions.filter((session) => session.activityId === activityId).map((session) => session.id));
  if (!preview.result.willArchive) {
    const deletedSlotIds = new Set(state.slots.filter((slot) => slot.activityId === activityId).map((slot) => slot.id));
    return transition(
      {
        ...state,
        activities: state.activities.filter((activity) => activity.id !== activityId),
        slots: state.slots.filter((slot) => slot.activityId !== activityId),
        sessions: state.sessions.filter((session) => session.activityId !== activityId),
        bookings: state.bookings.filter((booking) => !sessionIds.has(booking.sessionId)),
        enrollments: state.enrollments.filter((enrollment) => !deletedSlotIds.has(enrollment.slotId)),
      },
      { success: true, mode: "deleted", futureBookedStudents: 0 },
    );
  }
  const next = {
    ...state,
    activities: state.activities.map((activity) => (activity.id === activityId ? { ...activity, active: false } : activity)),
    bookings: state.bookings.map((booking) => {
      const session = sessionById(state, booking.sessionId);
      return booking.status === "CONFIRMED" &&
        session &&
        sessionIds.has(session.id) &&
        !session.cancelled &&
        new Date(session.startsAt).getTime() >= now.getTime()
        ? { ...booking, status: "CANCELLED" as const, cancelledAt: now.toISOString() }
        : booking;
    }),
  };
  return transition(next, { success: true, mode: "archived", futureBookedStudents: preview.result.futureBookedStudents });
}

function toSlotRow(slot: ManagedSlot): SlotRow {
  return {
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    date: slot.date,
    startMinute: slot.startMinute,
    endMinute: slot.endMinute,
    capacity: slot.capacity,
    active: slot.active,
  };
}

export function toActivityListRows(state: ManagementDemoState): ActivityListRow[] {
  return state.activities.map((activity) => ({
    ...activity,
    slots: state.slots
      .filter((slot) => slot.activityId === activity.id && slot.active)
      .map((slot) => ({ dayOfWeek: slot.dayOfWeek, date: slot.date, startMinute: slot.startMinute, endMinute: slot.endMinute })),
  }));
}

export function toManagedSlotRows(state: ManagementDemoState, activityId: string): SlotRow[] {
  return state.slots.filter((slot) => slot.activityId === activityId).map(toSlotRow);
}

export function toManagedSessionRows(state: ManagementDemoState, activityId: string): SessionRow[] {
  return state.sessions
    .filter((session) => session.activityId === activityId)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .map((session) => ({
      id: session.id,
      date: session.date,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      capacity: session.capacity,
      bookedCount: bookedCount(state, session.id),
      cancelled: session.cancelled,
    }));
}

export function toEnrollmentBookingRows(state: ManagementDemoState, sessionId: string): EnrollmentBookingRow[] {
  return confirmedBookings(state, sessionId)
    .map((booking) => {
      const student = studentById(state, booking.studentId)!;
      return { bookingId: booking.id, userId: student.id, name: student.name, accountKind: student.accountKind!, addedByStaff: booking.addedByStaff };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function toAvailableStudentOptions(state: ManagementDemoState, sessionId: string): StudentOption[] {
  const bookedStudents = new Set(confirmedBookings(state, sessionId).map((booking) => booking.studentId));
  return state.actors
    .filter((actor) => actor.role === "STUDENT" && !bookedStudents.has(actor.id))
    .map((student) => ({ id: student.id, name: student.name, accountKind: student.accountKind! }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function toStudentSessionRows(state: ManagementDemoState, studentId: string, now: Date): StudentSessionRow[] {
  const activeEnrollmentSlots = new Set(
    state.enrollments.filter((enrollment) => enrollment.studentId === studentId && enrollment.status === "ACTIVE").map((enrollment) => enrollment.slotId),
  );
  return state.sessions
    .filter((session) => {
      const activity = activityById(state, session.activityId);
      const slot = slotById(state, session.slotId);
      return new Date(session.startsAt).getTime() >= now.getTime() && !!activity?.active && !!slot?.active;
    })
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .map((session) => {
      const activity = activityById(state, session.activityId)!;
      const slot = slotById(state, session.slotId)!;
      const booking = state.bookings.find(
        (candidate) => candidate.sessionId === session.id && candidate.studentId === studentId && candidate.status === "CONFIRMED",
      );
      return {
        id: session.id,
        slotId: session.slotId,
        dayOfWeek: slot.dayOfWeek,
        activityName: activity.name,
        allowsRecurring: activity.allowsRecurring,
        date: session.date,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        capacity: session.capacity,
        bookedCount: bookedCount(state, session.id),
        cancelled: session.cancelled,
        bookingId: booking?.id ?? null,
        enrolledSlot: activeEnrollmentSlots.has(session.slotId),
      };
    });
}

export function toMyBookingRows(state: ManagementDemoState, studentId: string, now: Date): MyBookingRow[] {
  return state.bookings
    .filter((booking) => booking.studentId === studentId && booking.status === "CONFIRMED")
    .map((booking) => ({ booking, session: sessionById(state, booking.sessionId)! }))
    .filter(({ session }) => !session.cancelled && new Date(session.startsAt).getTime() >= now.getTime())
    .sort((left, right) => left.session.startsAt.localeCompare(right.session.startsAt))
    .map(({ booking, session }) => ({
      bookingId: booking.id,
      activityName: activityById(state, session.activityId)!.name,
      date: session.date,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    }));
}

export function toMyEnrollmentRows(state: ManagementDemoState, studentId: string): MyEnrollmentRow[] {
  return state.enrollments
    .filter((enrollment) => enrollment.studentId === studentId && enrollment.status === "ACTIVE")
    .map((enrollment) => {
      const slot = slotById(state, enrollment.slotId)!;
      const activity = activityById(state, slot.activityId)!;
      return { enrollmentId: enrollment.id, activityName: activity.name, dayOfWeek: slot.dayOfWeek, startMinute: slot.startMinute, endMinute: slot.endMinute };
    });
}

export function toManagementProjection(
  state: ManagementDemoState,
  activityId: string,
  sessionId: string,
  studentId: string,
  now: Date,
): ManagementProjection {
  return {
    activities: toActivityListRows(state),
    slots: toManagedSlotRows(state, activityId),
    sessions: toManagedSessionRows(state, activityId),
    bookings: toEnrollmentBookingRows(state, sessionId),
    availableStudents: toAvailableStudentOptions(state, sessionId),
    studentSessions: toStudentSessionRows(state, studentId, now),
    myBookings: toMyBookingRows(state, studentId, now),
    myEnrollments: toMyEnrollmentRows(state, studentId),
  };
}

export function reduceManagementDemo(
  state: ManagementDemoState,
  command: ManagementDemoCommand,
  now: Date,
): ManagementTransition<
  | ManagementResult
  | ManagementActivityResult
  | ManagementSlotResult
  | ManagementBookingResult
  | ManagementEnrollmentResult
  | ManagementDeletionResult
  | MaterializeResult
> {
  switch (command.type) {
    case "select-actor":
      return selectManagementDemoActor(state, command.actorId);
    case "create-activity":
      return createManagedActivity(state, command.input, command.slots, now);
    case "update-activity":
      return updateManagedActivity(state, command.activityId, command.input, now);
    case "create-slot":
      return manageSlot(state, command.activityId, command.input, undefined, now);
    case "update-slot":
      return manageSlot(state, command.activityId, command.input, command.slotId, now);
    case "deactivate-slot":
      return deactivateManagedSlot(state, command.activityId, command.slotId);
    case "materialize":
      return materializeUpcomingSessions(state, now);
    case "cancel-session":
      return cancelManagedSession(state, command.sessionId, now);
    case "manual-book":
      return manuallyBookStudent(state, command.sessionId, command.studentId, now);
    case "manual-unbook":
      return manuallyUnbookStudent(state, command.bookingId, now);
    case "student-book":
      return studentBookSession(state, command.studentId, command.sessionId, now);
    case "student-enroll":
      return studentEnrollInSlot(state, command.studentId, command.slotId, now);
    case "student-cancel-booking":
      return studentCancelBooking(state, command.studentId, command.bookingId, now);
    case "student-cancel-enrollment":
      return studentCancelEnrollment(state, command.studentId, command.enrollmentId, now);
    case "delete-activity":
      return deleteManagedActivity(state, command.activityId, now);
  }
}
