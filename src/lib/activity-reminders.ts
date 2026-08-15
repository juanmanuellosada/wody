import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { gymTerms } from "@/lib/gym-terms";

// Recordatorios de turno (ver design.md D8 y specs/turnos-reminders/spec.md).
// Push como único canal, sin fallback a email. Idempotente vía
// ActivityBooking.reminderSentAt: se estampa solo si el push salió bien.

const HOUR_MS = 60 * 60 * 1000;

function formatLocalTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

function buildReminderMessage(
  activityName: string,
  startsAt: Date,
  timezone: string,
  kindWord: string
): { title: string; body: string } {
  const time = formatLocalTime(startsAt, timezone);
  return {
    title: "Tu turno se acerca",
    body: `${activityName} empieza a las ${time} hs en el ${kindWord}.`,
  };
}

/**
 * Busca las ActivityBooking candidatas a recordatorio de un gym: confirmadas,
 * sin recordatorio enviado, con sesión no cancelada que arranca dentro de la
 * ventana de aviso del gym. Nunca cruza tenants: filtra tanto la reserva como
 * la sesión por gymId.
 *
 * Ojo: `reminderSentAt: null` filtra por IS NULL directo (no usa `not`, que
 * descartaría los NULL en silencio sobre esta columna nullable).
 */
async function findReminderCandidates(gym: {
  id: string;
  reminderLeadHours: number;
}) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + gym.reminderLeadHours * HOUR_MS);

  return prisma.activityBooking.findMany({
    where: {
      gymId: gym.id,
      status: "CONFIRMED",
      reminderSentAt: null,
      session: {
        gymId: gym.id,
        cancelled: false,
        startsAt: { gte: now, lte: windowEnd },
      },
    },
    select: {
      id: true,
      userId: true,
      session: {
        select: {
          startsAt: true,
          slot: { select: { activity: { select: { name: true } } } },
        },
      },
    },
  });
}

/**
 * Recorre los gyms con bookingEnabled=true, agrupa por su propia ventana de
 * aviso (Gym.reminderLeadHours) y envía el recordatorio por push a cada
 * reserva candidata. Un fallo individual de envío no aborta el resto.
 */
export async function sendActivityReminders(): Promise<{
  gymsProcessed: number;
  candidates: number;
  sent: number;
  failed: number;
}> {
  const gyms = await prisma.gym.findMany({
    where: { bookingEnabled: true },
    select: { id: true, kind: true, timezone: true, reminderLeadHours: true },
  });

  let totalCandidates = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const gym of gyms) {
    const candidates = await findReminderCandidates(gym);
    totalCandidates += candidates.length;
    const terms = gymTerms(gym.kind);

    for (const booking of candidates) {
      try {
        const { title, body } = buildReminderMessage(
          booking.session.slot.activity.name,
          booking.session.startsAt,
          gym.timezone,
          terms.kindWord
        );
        const { sent } = await sendPushToUser(booking.userId, title, body);
        if (sent > 0) {
          await prisma.activityBooking.update({
            where: { id: booking.id },
            data: { reminderSentAt: new Date() },
          });
          totalSent++;
        }
        // sent === 0 (sin PushSubscription activa, o todas fallaron): no se
        // estampa el sello, no hay otro canal, y seguimos con el resto.
      } catch (err) {
        totalFailed++;
        console.warn("[activity-reminders] Failed to send reminder", {
          bookingId: booking.id,
          userId: booking.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return {
    gymsProcessed: gyms.length,
    candidates: totalCandidates,
    sent: totalSent,
    failed: totalFailed,
  };
}
