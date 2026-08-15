import { prisma } from "@/lib/prisma";

// Horizonte de materialización de sesiones (ver design.md D2).
export const SESSION_HORIZON_WEEKS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Fecha de "hoy" en la zona horaria del gym, como medianoche UTC representando
 * esa fecha calendario (misma convención que los campos @db.Date del proyecto,
 * ver src/lib/dates.ts).
 */
function getTodayInTimezone(timezone: string): Date {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return new Date(Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day)));
}

/**
 * Offset (en minutos) de una zona horaria nombrada en un instante dado, tal que
 * `instant + offset = hora local` (ambos interpretados como campos UTC). Soporta
 * DST porque se recalcula por instante, no es un offset fijo.
 */
function getTimeZoneOffsetMinutes(instant: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUTC - instant.getTime()) / 60000;
}

/** Convierte minutos-desde-medianoche en hora local del gym a un instante absoluto para una fecha dada. */
export function localMinutesToInstant(date: Date, minutes: number, timezone: string): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const targetUTCFields = Date.UTC(year, month, day, hour, minute, 0);

  // Dos iteraciones alcanzan para converger, incluso alrededor de un cambio de DST.
  let instant = targetUTCFields;
  for (let i = 0; i < 2; i++) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(instant), timezone);
    instant = targetUTCFields - offsetMinutes * 60000;
  }
  return new Date(instant);
}

/** Materializa las sesiones faltantes de un slot hasta `through` (inclusive). Idempotente. */
export async function ensureSessionsForSlot(slotId: string, through: Date): Promise<number> {
  const slot = await prisma.activitySlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      dayOfWeek: true,
      startMinute: true,
      endMinute: true,
      capacity: true,
      active: true,
      activity: {
        select: {
          gymId: true,
          active: true,
          capacity: true,
          gym: { select: { timezone: true, bookingEnabled: true } },
        },
      },
    },
  });

  if (!slot || !slot.active || !slot.activity.active || !slot.activity.gym.bookingEnabled) {
    return 0;
  }

  const timezone = slot.activity.gym.timezone;
  const gymId = slot.activity.gymId;
  const today = getTodayInTimezone(timezone);
  if (through < today) return 0;

  const dates: Date[] = [];
  for (let d = today; d <= through; d = addDays(d, 1)) {
    if (d.getUTCDay() === slot.dayOfWeek) dates.push(d);
  }
  if (dates.length === 0) return 0;

  const data = dates.map((date) => ({
    gymId,
    slotId: slot.id,
    date,
    startsAt: localMinutesToInstant(date, slot.startMinute, timezone),
    endsAt: localMinutesToInstant(date, slot.endMinute, timezone),
    // Cupo propio del horario; si no tiene, cae al cupo por defecto de la actividad.
    capacity: slot.capacity ?? slot.activity.capacity,
    bookedCount: 0,
    cancelled: false,
  }));

  const result = await prisma.activitySession.createMany({ data, skipDuplicates: true });
  return result.count;
}

/**
 * Materializa los ActivityBooking derivados de una inscripción, para las sesiones
 * ya existentes desde ahora hasta el horizonte. Respeta el cupo (D3) e idempotente
 * vía @@unique([sessionId, userId]).
 */
export async function materializeEnrollmentBookings(enrollmentId: string): Promise<number> {
  const enrollment = await prisma.activityEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      gymId: true,
      userId: true,
      slotId: true,
      cancelledAt: true,
      slot: {
        select: {
          active: true,
          activity: { select: { active: true, gym: { select: { timezone: true } } } },
        },
      },
    },
  });

  if (!enrollment || enrollment.cancelledAt) return 0;
  if (!enrollment.slot.active || !enrollment.slot.activity.active) return 0;

  const timezone = enrollment.slot.activity.gym.timezone;
  const today = getTodayInTimezone(timezone);
  const through = addDays(today, SESSION_HORIZON_WEEKS * 7);

  const sessions = await prisma.activitySession.findMany({
    where: { slotId: enrollment.slotId, cancelled: false, date: { gte: today, lte: through } },
    select: { id: true, capacity: true, startsAt: true },
    orderBy: { date: "asc" },
  });

  const now = new Date();
  let bookingsCreated = 0;

  for (const session of sessions) {
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.activityBooking.findUnique({
        where: { sessionId_userId: { sessionId: session.id, userId: enrollment.userId } },
      });
      if (existing?.status === "CONFIRMED") return false;
      // D1: una inscripción recurrente es intención permanente y reconfirma
      // fechas futuras aunque el alumno las hubiera cancelado antes de
      // inscribirse. No tocar sesiones que ya empezaron.
      if (existing?.status === "CANCELLED" && session.startsAt <= now) return false;

      // capacity === null significa sin límite (no usar `not` sobre esta columna
      // nullable), pero bookedCount se incrementa siempre (unifica el criterio
      // con bookSingleSession/manuallyBookStudent, que sirve como dato de
      // ocupación aunque no haya límite explícito).
      if (session.capacity !== null) {
        const res = await tx.activitySession.updateMany({
          where: { id: session.id, bookedCount: { lt: session.capacity } },
          data: { bookedCount: { increment: 1 } },
        });
        if (res.count === 0) return false; // sesión llena
      } else {
        await tx.activitySession.update({
          where: { id: session.id },
          data: { bookedCount: { increment: 1 } },
        });
      }

      if (existing) {
        // Reactiva la fila cancelada en vez de insertar duplicado (constraint no parcial).
        await tx.activityBooking.update({
          where: { id: existing.id },
          data: { status: "CONFIRMED", source: "ENROLLMENT", cancelledAt: null },
        });
      } else {
        await tx.activityBooking.create({
          data: {
            gymId: enrollment.gymId,
            sessionId: session.id,
            userId: enrollment.userId,
            source: "ENROLLMENT",
            status: "CONFIRMED",
          },
        });
      }
      return true;
    });

    if (created) bookingsCreated++;
  }

  return bookingsCreated;
}

/**
 * Materializa todas las sesiones faltantes de un gym hasta el horizonte, y crea los
 * ActivityBooking derivados de las inscripciones activas. Idempotente.
 */
export async function materializeGymSessions(
  gymId: string,
  horizonWeeks: number = SESSION_HORIZON_WEEKS
): Promise<{ sessionsCreated: number; bookingsCreated: number }> {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { bookingEnabled: true, timezone: true },
  });

  if (!gym || !gym.bookingEnabled) return { sessionsCreated: 0, bookingsCreated: 0 };

  const through = addDays(getTodayInTimezone(gym.timezone), horizonWeeks * 7);

  const slots = await prisma.activitySlot.findMany({
    where: { active: true, activity: { gymId, active: true } },
    select: { id: true },
  });

  let sessionsCreated = 0;
  for (const slot of slots) {
    sessionsCreated += await ensureSessionsForSlot(slot.id, through);
  }

  const enrollments = await prisma.activityEnrollment.findMany({
    where: { gymId, cancelledAt: null, slot: { active: true, activity: { active: true } } },
    select: { id: true },
  });

  let bookingsCreated = 0;
  for (const enrollment of enrollments) {
    bookingsCreated += await materializeEnrollmentBookings(enrollment.id);
  }

  return { sessionsCreated, bookingsCreated };
}
