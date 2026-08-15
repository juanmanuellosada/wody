"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { gymPath } from "@/lib/gym";
import { materializeEnrollmentBookings } from "@/lib/activity-schedule";

/**
 * Server actions de auto-reserva del alumno (STUDENT) sobre ActivitySession /
 * ActivityEnrollment (ver openspec/changes/add-turnos-booking/specs/turnos-booking/spec.md
 * y design.md D1/D3/D4/D9).
 *
 * Reglas duras que replican el patrón ya usado en src/actions/activity.ts
 * (manuallyBookStudent/manuallyUnbookStudent) para no tener dos semánticas
 * distintas sobre la misma tabla:
 * - `@@unique([sessionId, userId])` en ActivityBooking NO es parcial: cancelar
 *   nunca borra la fila, marca status=CANCELLED. Reactivar hace upsert sobre
 *   la fila existente en vez de insertar duplicado.
 * - Cupo atómico (D3): leer `capacity` primero (nullable = sin límite, nunca
 *   usar `not` sobre esa columna), luego `updateMany` condicional sobre
 *   `bookedCount`. Igual para el decrement al cancelar.
 * - Solo un STUDENT autenticado del propio gym puede reservar (spec "Solo
 *   usuarios del gym pueden reservar"): no hay reserva pública ni anónima.
 * - Cuentas LITE no tienen login, pero se valida igual del lado server (mismo
 *   patrón que src/actions/fixed-routine.ts).
 */

const HOUR_MS = 60 * 60 * 1000;

async function assertStudent() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT" || !session.user.gymId || !session.user.gymSlug) {
    return { ok: false as const, error: "No autorizado." };
  }
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, gymId: session.user.gymId, deletedAt: null },
    select: { id: true, accountKind: true },
  });
  if (!user) return { ok: false as const, error: "No autorizado." };
  if (user.accountKind === "LITE") {
    return { ok: false as const, error: "Tu cuenta no puede reservar turnos por sí misma. Pedile al profe que te anote." };
  }
  return { ok: true as const, gymId: session.user.gymId, gymSlug: session.user.gymSlug, userId: user.id };
}

function revalidateStudentViews(gymSlug: string) {
  revalidatePath(gymPath(gymSlug, "/turnos"));
  revalidatePath(gymPath(gymSlug, "/turnos/mis-turnos"));
}

export type BookActionResult =
  | { success: true; bookingId: string }
  | { success: false; error: string };

export type EnrollActionResult =
  | { success: true; enrollmentId: string; bookingsCreated: number }
  | { success: false; error: string };

export type SimpleActionResult =
  | { success: true }
  | { success: false; error: string };

/** Reserva puntual de una fecha concreta (solo esa sesión). */
export async function bookSingleSession(sessionId: string): Promise<BookActionResult> {
  const check = await assertStudent();
  if (!check.ok) return { success: false, error: check.error };
  const { gymId, userId } = check;

  const activitySession = await prisma.activitySession.findFirst({
    where: { id: sessionId },
    select: {
      id: true,
      gymId: true,
      cancelled: true,
      capacity: true,
      slot: { select: { active: true, activity: { select: { active: true } } } },
    },
  });
  if (!activitySession || activitySession.gymId !== gymId) {
    return { success: false, error: "Sesión no encontrada." };
  }
  if (activitySession.cancelled) {
    return { success: false, error: "Esta sesión fue cancelada." };
  }
  if (!activitySession.slot.active || !activitySession.slot.activity.active) {
    return { success: false, error: "Esta actividad ya no está disponible." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.activityBooking.findUnique({
        where: { sessionId_userId: { sessionId, userId } },
      });
      if (existing?.status === "CONFIRMED") {
        return { ok: false as const, error: "Ya estás anotado en esta sesión." };
      }

      // capacity === null significa sin límite (no usar `not` sobre esta columna nullable).
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
        // Reactiva la fila cancelada en vez de insertar duplicado (constraint no parcial).
        const updated = await tx.activityBooking.update({
          where: { id: existing.id },
          data: { status: "CONFIRMED", source: "SINGLE", createdById: null, cancelledAt: null },
          select: { id: true },
        });
        bookingId = updated.id;
      } else {
        const created = await tx.activityBooking.create({
          data: { gymId, sessionId, userId, source: "SINGLE", status: "CONFIRMED" },
          select: { id: true },
        });
        bookingId = created.id;
      }

      return { ok: true as const, bookingId };
    });

    if (!result.ok) return { success: false, error: result.error };

    revalidateStudentViews(check.gymSlug);
    return { success: true, bookingId: result.bookingId };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya estás anotado en esta sesión." };
    }
    throw error;
  }
}

/**
 * Inscripción recurrente ("a todas"): crea/reactiva la ActivityEnrollment
 * sobre el slot y deriva los ActivityBooking hasta el horizonte reusando
 * materializeEnrollmentBookings (ya implementado en src/lib/activity-schedule.ts,
 * respeta cupo de forma atómica e idempotente).
 */
export async function enrollInSlot(slotId: string): Promise<EnrollActionResult> {
  const check = await assertStudent();
  if (!check.ok) return { success: false, error: check.error };
  const { gymId, userId } = check;

  const slot = await prisma.activitySlot.findFirst({
    where: { id: slotId },
    select: {
      id: true,
      active: true,
      activity: { select: { gymId: true, active: true, allowsRecurring: true, scheduleKind: true } },
    },
  });
  if (!slot || slot.activity.gymId !== gymId) {
    return { success: false, error: "Horario no encontrado." };
  }
  if (!slot.active || !slot.activity.active) {
    return { success: false, error: "Este horario ya no está disponible." };
  }
  // Una actividad de fecha única (ONE_OFF) no tiene "todas las semanas" a las
  // que inscribirse: allowsRecurring es un flag distinto y queda irrelevante
  // en este modo (ver openspec/changes/add-turnos-booking specs/turnos-booking).
  if (slot.activity.scheduleKind === "ONE_OFF") {
    return { success: false, error: "Esta actividad no admite inscripción recurrente." };
  }
  if (!slot.activity.allowsRecurring) {
    return { success: false, error: "Esta actividad no admite inscripción recurrente." };
  }

  const existing = await prisma.activityEnrollment.findUnique({
    where: { slotId_userId: { slotId, userId } },
  });
  if (existing && !existing.cancelledAt) {
    return { success: false, error: "Ya estás inscripto a este horario." };
  }

  let enrollmentId: string;
  try {
    if (existing) {
      // Reactiva la fila cancelada en vez de insertar duplicado (constraint no parcial).
      const updated = await prisma.activityEnrollment.update({
        where: { id: existing.id },
        data: { cancelledAt: null },
        select: { id: true },
      });
      enrollmentId = updated.id;
    } else {
      const created = await prisma.activityEnrollment.create({
        data: { gymId, slotId, userId },
        select: { id: true },
      });
      enrollmentId = created.id;
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya estás inscripto a este horario." };
    }
    throw error;
  }

  const bookingsCreated = await materializeEnrollmentBookings(enrollmentId);

  revalidateStudentViews(check.gymSlug);
  return { success: true, enrollmentId, bookingsCreated };
}

/**
 * Cancela la reserva de una fecha concreta. Deja intacta la ActivityEnrollment
 * (si existe) — cancelar una fecha nunca desanota al alumno de las demás
 * (spec "Cancelación de una fecha no afecta la inscripción recurrente").
 * Valida la ventana de cancelación en el server (Activity.cancelWindowHours).
 */
export async function cancelBooking(bookingId: string): Promise<SimpleActionResult> {
  const check = await assertStudent();
  if (!check.ok) return { success: false, error: check.error };

  const booking = await prisma.activityBooking.findFirst({
    where: { id: bookingId },
    select: {
      id: true,
      gymId: true,
      userId: true,
      sessionId: true,
      status: true,
      session: {
        select: {
          startsAt: true,
          slot: { select: { activity: { select: { cancelWindowHours: true } } } },
        },
      },
    },
  });
  if (!booking || booking.gymId !== check.gymId || booking.userId !== check.userId) {
    return { success: false, error: "Reserva no encontrada." };
  }
  if (booking.status !== "CONFIRMED") {
    return { success: false, error: "La reserva ya estaba cancelada." };
  }

  const cancelWindowHours = booking.session.slot.activity.cancelWindowHours;
  const remainingMs = booking.session.startsAt.getTime() - Date.now();
  if (remainingMs < cancelWindowHours * HOUR_MS) {
    return {
      success: false,
      error: `Ya no se puede cancelar: hay que hacerlo con al menos ${cancelWindowHours}hs de anticipación.`,
    };
  }

  await prisma.$transaction([
    prisma.activityBooking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
    prisma.activitySession.update({ where: { id: booking.sessionId }, data: { bookedCount: { decrement: 1 } } }),
  ]);

  revalidateStudentViews(check.gymSlug);
  return { success: true };
}

/**
 * Cancela la inscripción recurrente: baja todas las ActivityBooking futuras
 * derivadas de ella (status CONFIRMED, source ENROLLMENT, del mismo slot) y
 * deja intactas las pasadas. No hay ventana de cancelación para esta acción
 * (solo aplica a ActivityBooking puntuales, ver spec).
 */
export async function cancelEnrollment(enrollmentId: string): Promise<SimpleActionResult> {
  const check = await assertStudent();
  if (!check.ok) return { success: false, error: check.error };

  const enrollment = await prisma.activityEnrollment.findFirst({
    where: { id: enrollmentId },
    select: { id: true, gymId: true, userId: true, slotId: true, cancelledAt: true },
  });
  if (!enrollment || enrollment.gymId !== check.gymId || enrollment.userId !== check.userId) {
    return { success: false, error: "Inscripción no encontrada." };
  }
  if (enrollment.cancelledAt) {
    return { success: false, error: "La inscripción ya estaba cancelada." };
  }

  const futureBookings = await prisma.activityBooking.findMany({
    where: {
      userId: enrollment.userId,
      source: "ENROLLMENT",
      status: "CONFIRMED",
      session: { slotId: enrollment.slotId, startsAt: { gt: new Date() } },
    },
    select: { id: true, sessionId: true },
  });

  await prisma.$transaction([
    prisma.activityEnrollment.update({ where: { id: enrollmentId }, data: { cancelledAt: new Date() } }),
    ...futureBookings.flatMap((b) => [
      prisma.activityBooking.update({ where: { id: b.id }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
      prisma.activitySession.update({ where: { id: b.sessionId }, data: { bookedCount: { decrement: 1 } } }),
    ]),
  ]);

  revalidateStudentViews(check.gymSlug);
  return { success: true };
}
