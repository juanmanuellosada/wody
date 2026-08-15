"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { gymPath } from "@/lib/gym";
import { SESSION_HORIZON_WEEKS, ensureSessionsForSlot } from "@/lib/activity-schedule";
import { sendPushToUser } from "@/lib/push";

/**
 * Server actions de Actividad (Activity) y horarios recurrentes (ActivitySlot),
 * más gestión manual de inscriptos (ActivityBooking) y cancelación de una
 * sesión puntual (ActivitySession).
 *
 * Permisos (ver openspec/changes/add-turnos-booking/specs/turnos-activities/spec.md,
 * requirement "Permisos de gestión de Actividades"):
 * - ADMIN gestiona todas las Activity de su gym.
 * - TEACHER gestiona únicamente las Activity donde figura como teacherId a
 *   cargo, y como mínimo puede ver y anotar/desanotar inscriptos.
 * - Todo se valida acá, no solo en la UI.
 *
 * `ensureSessionsForSlot` y `SESSION_HORIZON_WEEKS` los provee
 * src/lib/activity-schedule.ts (otro agente trabaja ese archivo en paralelo,
 * ver design.md D2/D5 y tasks 4.1-4.6). Se usan acá solo para materializar
 * de inmediato un horario recién creado, así el admin no espera al cron del
 * día siguiente para ver sus primeras sesiones.
 */

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function revalidateActivityViews(gymSlug: string, activityId?: string) {
  revalidatePath(gymPath(gymSlug, "/turnos/gestion"));
  if (activityId) revalidatePath(gymPath(gymSlug, `/turnos/gestion/${activityId}`));
}

export type ActivityRow = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  teacherId: string | null;
  teacherName: string | null;
  allowsRecurring: boolean;
  cancelWindowHours: number;
  /** Cupo por defecto de la actividad; lo usa un ActivitySlot cuando el suyo propio es null. */
  capacity: number | null;
  active: boolean;
};

export type ActivityActionResult =
  | { success: true; activity: ActivityRow }
  | { success: false; error: string };

export type SimpleActionResult =
  | { success: true }
  | { success: false; error: string };

const ACTIVITY_SELECT = {
  id: true,
  name: true,
  description: true,
  color: true,
  teacherId: true,
  allowsRecurring: true,
  cancelWindowHours: true,
  capacity: true,
  active: true,
  teacher: { select: { name: true } },
} satisfies Prisma.ActivitySelect;

function toActivityRow(a: {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  teacherId: string | null;
  allowsRecurring: boolean;
  cancelWindowHours: number;
  capacity: number | null;
  active: boolean;
  teacher: { name: string } | null;
}): ActivityRow {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    color: a.color,
    teacherId: a.teacherId,
    teacherName: a.teacher?.name ?? null,
    allowsRecurring: a.allowsRecurring,
    cancelWindowHours: a.cancelWindowHours,
    capacity: a.capacity,
    active: a.active,
  };
}

async function assertCanManageActivities() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") ||
    !session.user.gymId ||
    !session.user.gymSlug
  ) {
    return { ok: false as const, error: "No autorizado." };
  }
  return {
    ok: true as const,
    session,
    gymId: session.user.gymId,
    gymSlug: session.user.gymSlug,
    role: session.user.role,
    userId: session.user.id,
  };
}

async function assertActivityManager(activityId: string) {
  const check = await assertCanManageActivities();
  if (!check.ok) return check;

  const activity = await prisma.activity.findFirst({
    where: { id: activityId },
    select: { id: true, gymId: true, teacherId: true },
  });
  if (!activity || activity.gymId !== check.gymId) {
    return { ok: false as const, error: "Actividad no encontrada." };
  }
  if (check.role === "TEACHER" && activity.teacherId !== check.userId) {
    return { ok: false as const, error: "No autorizado." };
  }

  return { ...check, activity };
}

async function assertSlotManager(slotId: string) {
  const check = await assertCanManageActivities();
  if (!check.ok) return check;

  const slot = await prisma.activitySlot.findFirst({
    where: { id: slotId },
    select: { id: true, activityId: true, activity: { select: { gymId: true, teacherId: true } } },
  });
  if (!slot || slot.activity.gymId !== check.gymId) {
    return { ok: false as const, error: "Horario no encontrado." };
  }
  if (check.role === "TEACHER" && slot.activity.teacherId !== check.userId) {
    return { ok: false as const, error: "No autorizado." };
  }

  return { ...check, slot };
}

function validateActivityInput(input: {
  name: string;
  cancelWindowHours: number;
  capacity: number | null;
}): string | null {
  if (!input.name.trim()) return "El nombre es obligatorio.";
  if (!Number.isFinite(input.cancelWindowHours) || input.cancelWindowHours < 0) {
    return "La ventana de cancelación debe ser un número mayor o igual a cero.";
  }
  if (input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
    return "El cupo debe ser un número entero positivo, o vacío para sin límite.";
  }
  return null;
}

export type ActivityInput = {
  name: string;
  description?: string | null;
  color?: string | null;
  /** undefined = no tocar (solo relevante en edición para TEACHER); ADMIN siempre debe mandar un valor explícito. */
  teacherId?: string | null;
  allowsRecurring: boolean;
  cancelWindowHours: number;
  /** Cupo por defecto de la actividad (null = sin límite); cada ActivitySlot puede pisarlo con el suyo propio. */
  capacity: number | null;
};

/**
 * Crea la Activity y sus horarios (ActivitySlot) en una sola operación
 * (spec: "Alta de Actividad con horarios en un solo paso"). Requiere al
 * menos un horario; los valida igual que createActivitySlot y además
 * rechaza solapamientos entre horarios del mismo día dentro de la misma
 * alta.
 */
export async function createActivity(
  input: ActivityInput,
  slots: SlotInput[]
): Promise<ActivityActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };

  const validationError = validateActivityInput(input);
  if (validationError) return { success: false, error: validationError };

  const slotsError = validateSlots(slots);
  if (slotsError) return { success: false, error: slotsError };

  let teacherId: string | null = null;
  if (check.role === "TEACHER") {
    // Un TEACHER siempre queda a cargo de lo que crea, sin importar lo que
    // mande el cliente (spec: "Un TEACHER no puede asignar a otro profe").
    teacherId = check.userId;
  } else if (input.teacherId) {
    const teacher = await prisma.user.findFirst({
      where: { id: input.teacherId, gymId: check.gymId, role: "TEACHER", deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return { success: false, error: "Profe no encontrado." };
    teacherId = teacher.id;
  }

  const { activity, slotIds } = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        gymId: check.gymId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color?.trim() || null,
        teacherId,
        allowsRecurring: input.allowsRecurring,
        cancelWindowHours: Math.round(input.cancelWindowHours),
        capacity: input.capacity,
      },
      select: ACTIVITY_SELECT,
    });

    const ids: string[] = [];
    for (const s of slots) {
      const slot = await tx.activitySlot.create({
        data: {
          activityId: created.id,
          dayOfWeek: s.dayOfWeek,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          capacity: s.capacity,
        },
        select: { id: true },
      });
      ids.push(slot.id);
    }

    return { activity: created, slotIds: ids };
  });

  // Materializar de inmediato, igual que createActivitySlot: sin esto el
  // admin no ve ninguna sesión hasta que corra el cron del día siguiente.
  await Promise.all(
    slotIds.map((id) =>
      ensureSessionsForSlot(id, addWeeks(new Date(), SESSION_HORIZON_WEEKS)).catch(() => 0)
    )
  );

  revalidateActivityViews(check.gymSlug);
  return { success: true, activity: toActivityRow(activity) };
}

export async function updateActivity(activityId: string, input: ActivityInput): Promise<ActivityActionResult> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const validationError = validateActivityInput(input);
  if (validationError) return { success: false, error: validationError };

  let teacherId = check.activity.teacherId;
  if (check.role === "TEACHER") {
    teacherId = check.userId;
  } else if (input.teacherId !== undefined) {
    if (input.teacherId === null) {
      teacherId = null;
    } else {
      const teacher = await prisma.user.findFirst({
        where: { id: input.teacherId, gymId: check.gymId, role: "TEACHER", deletedAt: null },
        select: { id: true },
      });
      if (!teacher) return { success: false, error: "Profe no encontrado." };
      teacherId = teacher.id;
    }
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color?.trim() || null,
      teacherId,
      allowsRecurring: input.allowsRecurring,
      cancelWindowHours: Math.round(input.cancelWindowHours),
      capacity: input.capacity,
    },
    select: ACTIVITY_SELECT,
  });

  revalidateActivityViews(check.gymSlug, activityId);
  return { success: true, activity: toActivityRow(activity) };
}

export type SlotRow = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  capacity: number | null;
  active: boolean;
};

export type SlotActionResult =
  | { success: true; slot: SlotRow }
  | { success: false; error: string };

export type SlotInput = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  capacity: number | null;
};

function validateSlotInput(input: SlotInput): string | null {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    return "El día de la semana no es válido.";
  }
  if (!Number.isInteger(input.startMinute) || input.startMinute < 0 || input.startMinute >= 1440) {
    return "La hora de inicio no es válida.";
  }
  if (!Number.isInteger(input.endMinute) || input.endMinute <= input.startMinute || input.endMinute > 1440) {
    return "La hora de fin debe ser posterior a la de inicio.";
  }
  if (input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
    return "El cupo debe ser un número entero positivo, o vacío para sin límite.";
  }
  return null;
}

function slotsOverlap(a: SlotInput, b: SlotInput): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** Valida la lista de horarios del alta en un paso: al menos uno, cada uno válido, sin solapamientos el mismo día. */
function validateSlots(slots: SlotInput[]): string | null {
  if (slots.length === 0) return "Agregá al menos un horario.";
  for (const s of slots) {
    const err = validateSlotInput(s);
    if (err) return err;
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) return "Hay horarios superpuestos el mismo día.";
    }
  }
  return null;
}

export async function createActivitySlot(activityId: string, input: SlotInput): Promise<SlotActionResult> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const validationError = validateSlotInput(input);
  if (validationError) return { success: false, error: validationError };

  const slot = await prisma.activitySlot.create({
    data: {
      activityId,
      dayOfWeek: input.dayOfWeek,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      capacity: input.capacity,
    },
  });

  // Materializar de inmediato: sin esto, un horario recién creado no muestra
  // ninguna sesión hasta que corra el cron del día siguiente (ver design.md
  // D2 y tasks 4.2/4.6 — no bloquea el alta si el helper falla).
  try {
    await ensureSessionsForSlot(slot.id, addWeeks(new Date(), SESSION_HORIZON_WEEKS));
  } catch {
    // El cron diario lo termina materializando igual.
  }

  revalidateActivityViews(check.gymSlug, activityId);
  return {
    success: true,
    slot: {
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      capacity: slot.capacity,
      active: slot.active,
    },
  };
}

export async function updateActivitySlot(slotId: string, input: SlotInput): Promise<SlotActionResult> {
  const check = await assertSlotManager(slotId);
  if (!check.ok) return { success: false, error: check.error };

  const validationError = validateSlotInput(input);
  if (validationError) return { success: false, error: validationError };

  const slot = await prisma.activitySlot.update({
    where: { id: slotId },
    data: {
      dayOfWeek: input.dayOfWeek,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      capacity: input.capacity,
    },
  });

  revalidateActivityViews(check.gymSlug, check.slot.activityId);
  return {
    success: true,
    slot: {
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      capacity: slot.capacity,
      active: slot.active,
    },
  };
}

export async function deactivateActivitySlot(slotId: string): Promise<SimpleActionResult> {
  const check = await assertSlotManager(slotId);
  if (!check.ok) return { success: false, error: check.error };

  await prisma.activitySlot.update({ where: { id: slotId }, data: { active: false } });
  revalidateActivityViews(check.gymSlug, check.slot.activityId);
  return { success: true };
}

function buildSessionCancellationMessage(
  activityName: string,
  startsAt: Date,
  timezone: string
): { title: string; body: string } {
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(startsAt);
  return {
    title: "Turno cancelado",
    body: `${activityName} de las ${time} hs fue cancelado.`,
  };
}

/**
 * Cancela una ActivitySession puntual sin tocar el ActivitySlot que la
 * originó (no afecta las demás fechas del horario recurrente). Deja sin
 * efecto las ActivityBooking confirmadas de esa sesión y avisa por push a
 * los alumnos que tenían reserva confirmada (spec: "Cancelación de sesión
 * notifica a los inscriptos"). Un fallo de envío individual no aborta la
 * cancelación, que ya quedó confirmada en la transacción.
 */
export async function cancelActivitySession(sessionId: string): Promise<SimpleActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };

  const activitySession = await prisma.activitySession.findFirst({
    where: { id: sessionId },
    select: {
      id: true,
      gymId: true,
      cancelled: true,
      startsAt: true,
      gym: { select: { timezone: true } },
      slot: { select: { activityId: true, activity: { select: { name: true, teacherId: true } } } },
    },
  });
  if (!activitySession || activitySession.gymId !== check.gymId) {
    return { success: false, error: "Sesión no encontrada." };
  }
  if (check.role === "TEACHER" && activitySession.slot.activity.teacherId !== check.userId) {
    return { success: false, error: "No autorizado." };
  }
  if (activitySession.cancelled) {
    return { success: false, error: "La sesión ya está cancelada." };
  }

  const confirmedBookings = await prisma.activityBooking.findMany({
    where: { sessionId, status: "CONFIRMED" },
    select: { userId: true },
  });

  await prisma.$transaction([
    prisma.activitySession.update({ where: { id: sessionId }, data: { cancelled: true } }),
    prisma.activityBooking.updateMany({
      where: { sessionId, status: "CONFIRMED" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
  ]);

  const { title, body } = buildSessionCancellationMessage(
    activitySession.slot.activity.name,
    activitySession.startsAt,
    activitySession.gym.timezone
  );
  await Promise.all(
    confirmedBookings.map(async ({ userId }) => {
      try {
        await sendPushToUser(userId, title, body);
      } catch (err) {
        console.warn("[activity] Failed to send session cancellation push", {
          sessionId,
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  const activityId = activitySession.slot.activityId;
  revalidateActivityViews(check.gymSlug, activityId);
  revalidatePath(gymPath(check.gymSlug, `/turnos/gestion/${activityId}/sesiones/${sessionId}`));
  return { success: true };
}

/** Alguna vez tuvo una ActivityBooking (confirmada o cancelada) en cualquiera de sus sesiones. */
async function activityHasAnyBookingEver(activityId: string): Promise<boolean> {
  const booking = await prisma.activityBooking.findFirst({
    where: { session: { slot: { activityId } } },
    select: { id: true },
  });
  return !!booking;
}

function futureConfirmedBookingsWhere(activityId: string) {
  return {
    status: "CONFIRMED" as const,
    session: { slot: { activityId }, cancelled: false, startsAt: { gte: new Date() } },
  };
}

export type DeleteActivityPreview =
  | { success: true; willArchive: boolean; futureBookedStudents: number }
  | { success: false; error: string };

/**
 * Calcula qué va a pasar si se elimina la actividad, para mostrarlo en la
 * confirmación antes de ejecutar (spec: "Eliminación de Actividad").
 */
export async function previewActivityDeletion(activityId: string): Promise<DeleteActivityPreview> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const willArchive = await activityHasAnyBookingEver(activityId);
  const futureBookedStudents = willArchive
    ? await prisma.activityBooking.count({ where: futureConfirmedBookingsWhere(activityId) })
    : 0;

  return { success: true, willArchive, futureBookedStudents };
}

export type DeleteActivityResult =
  | { success: true; mode: "deleted" | "archived"; futureBookedStudents: number }
  | { success: false; error: string };

/**
 * Único botón "Eliminar" (spec: "Eliminación de Actividad"). Si la actividad
 * nunca tuvo una ActivityBooking, borrado real (la cascada del schema se
 * lleva slots y sesiones). Si tuvo alguna vez, se archiva (`active = false`)
 * preservando el historial, y se notifica por push a los alumnos con reserva
 * confirmada en sesiones futuras, igual que cancelActivitySession.
 */
export async function deleteActivity(activityId: string): Promise<DeleteActivityResult> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const hadAnyBooking = await activityHasAnyBookingEver(activityId);

  if (!hadAnyBooking) {
    await prisma.activity.delete({ where: { id: activityId } });
    revalidateActivityViews(check.gymSlug, activityId);
    return { success: true, mode: "deleted", futureBookedStudents: 0 };
  }

  const details = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    select: { name: true, gym: { select: { timezone: true } } },
  });

  const futureBookings = await prisma.activityBooking.findMany({
    where: futureConfirmedBookingsWhere(activityId),
    select: { userId: true, session: { select: { startsAt: true } } },
  });

  await prisma.$transaction([
    prisma.activity.update({ where: { id: activityId }, data: { active: false } }),
    prisma.activityBooking.updateMany({
      where: futureConfirmedBookingsWhere(activityId),
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
  ]);

  await Promise.all(
    futureBookings.map(async ({ userId, session }) => {
      const { title, body } = buildSessionCancellationMessage(details.name, session.startsAt, details.gym.timezone);
      try {
        await sendPushToUser(userId, title, body);
      } catch (err) {
        console.warn("[activity] Failed to send activity archival push", {
          activityId,
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  revalidateActivityViews(check.gymSlug, activityId);
  return { success: true, mode: "archived", futureBookedStudents: futureBookings.length };
}

export type BookActionResult =
  | { success: true; bookingId: string }
  | { success: false; error: string };

/**
 * Alta manual de un alumno en una sesión (D6: necesario para cuentas LITE,
 * que no tienen login). Cupo validado de forma atómica (D3): `capacity`
 * nullable = sin límite; nunca comparar columnas entre sí en Prisma, por
 * eso el `updateMany` condicional con el valor leído previamente.
 */
export async function manuallyBookStudent(sessionId: string, studentUserId: string): Promise<BookActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };
  const { gymId } = check;

  const activitySession = await prisma.activitySession.findFirst({
    where: { id: sessionId },
    select: {
      id: true,
      gymId: true,
      cancelled: true,
      capacity: true,
      slot: { select: { activityId: true, activity: { select: { teacherId: true } } } },
    },
  });
  if (!activitySession || activitySession.gymId !== gymId) {
    return { success: false, error: "Sesión no encontrada." };
  }
  if (check.role === "TEACHER" && activitySession.slot.activity.teacherId !== check.userId) {
    return { success: false, error: "No autorizado." };
  }
  if (activitySession.cancelled) {
    return { success: false, error: "No se puede anotar en una sesión cancelada." };
  }

  const student = await prisma.user.findFirst({
    where: { id: studentUserId, gymId, role: "STUDENT", deletedAt: null },
    select: { id: true },
  });
  if (!student) return { success: false, error: "Alumno no encontrado." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.activityBooking.findUnique({
        where: { sessionId_userId: { sessionId, userId: studentUserId } },
      });
      if (existing?.status === "CONFIRMED") {
        return { ok: false as const, error: "El alumno ya está anotado en esta sesión." };
      }

      if (activitySession.capacity === null) {
        await tx.activitySession.update({ where: { id: sessionId }, data: { bookedCount: { increment: 1 } } });
      } else {
        const updated = await tx.activitySession.updateMany({
          where: { id: sessionId, bookedCount: { lt: activitySession.capacity } },
          data: { bookedCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          return { ok: false as const, error: "No hay cupo disponible en esta sesión." };
        }
      }

      let bookingId: string;
      if (existing) {
        const updated = await tx.activityBooking.update({
          where: { id: existing.id },
          data: { status: "CONFIRMED", source: "SINGLE", createdById: check.userId, cancelledAt: null },
          select: { id: true },
        });
        bookingId = updated.id;
      } else {
        const created = await tx.activityBooking.create({
          data: {
            gymId,
            sessionId,
            userId: studentUserId,
            source: "SINGLE",
            status: "CONFIRMED",
            createdById: check.userId,
          },
          select: { id: true },
        });
        bookingId = created.id;
      }

      return { ok: true as const, bookingId };
    });

    if (!result.ok) return { success: false, error: result.error };

    revalidatePath(
      gymPath(check.gymSlug, `/turnos/gestion/${activitySession.slot.activityId}/sesiones/${sessionId}`)
    );
    return { success: true, bookingId: result.bookingId };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "El alumno ya está anotado en esta sesión." };
    }
    throw error;
  }
}

/** Desanota manualmente a un alumno de una sesión. */
export async function manuallyUnbookStudent(bookingId: string): Promise<SimpleActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };

  const booking = await prisma.activityBooking.findFirst({
    where: { id: bookingId },
    select: {
      id: true,
      gymId: true,
      sessionId: true,
      status: true,
      session: { select: { slot: { select: { activityId: true, activity: { select: { teacherId: true } } } } } },
    },
  });
  if (!booking || booking.gymId !== check.gymId) {
    return { success: false, error: "Reserva no encontrada." };
  }
  if (check.role === "TEACHER" && booking.session.slot.activity.teacherId !== check.userId) {
    return { success: false, error: "No autorizado." };
  }
  if (booking.status !== "CONFIRMED") {
    return { success: false, error: "La reserva ya estaba cancelada." };
  }

  await prisma.$transaction([
    prisma.activityBooking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
    prisma.activitySession.update({ where: { id: booking.sessionId }, data: { bookedCount: { decrement: 1 } } }),
  ]);

  revalidatePath(
    gymPath(check.gymSlug, `/turnos/gestion/${booking.session.slot.activityId}/sesiones/${booking.sessionId}`)
  );
  return { success: true };
}
