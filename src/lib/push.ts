import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina } from "@/lib/dates";
import { gymTerms } from "@/lib/gym-terms";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS_AHEAD = 2;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) {
    throw new Error(
      "Missing VAPID env vars (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)"
    );
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string
): Promise<{ sent: number; removed: number }> {
  ensureConfigured();

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0, removed: 0 };

  const payload = JSON.stringify({ title, body });
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: unknown) {
        // 404/410 → subscription is gone; remove it so we don't keep trying.
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          removed++;
        } else {
          console.error("web-push send failed", err);
        }
      }
    })
  );

  return { sent, removed };
}

function bodyForDaysRemaining(days: number, word: string): string {
  if (days <= 0) return `Tu cuota vence hoy. Pasá por tu ${word} para renovar.`;
  if (days === 1)
    return `Tu cuota vence mañana. Pasá por tu ${word} para renovar.`;
  return `Tu cuota vence en ${days} días. Pasá por tu ${word} para renovar.`;
}

// Manda el recordatorio de vencimiento al alumno si aplica. Dedupea por día
// (Argentina) vía User.lastDueNotifiedOn: no importa si lo dispara el cron o
// el login, como máximo una push por alumno por día. Si está fuera de rango,
// bloqueado, o ya fue notificado hoy, no hace nada.
export async function sendDueReminderIfNeeded(
  userId: string,
  today: Date = getTodayArgentina()
): Promise<{ sent: boolean; reason: string }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      role: true,
      blockedAt: true,
      nextPaymentDate: true,
      lastDueNotifiedOn: true,
      gym: { select: { name: true, kind: true, blockedAt: true } },
    },
  });

  if (!user) return { sent: false, reason: "user-not-found" };
  if (user.role !== "STUDENT") return { sent: false, reason: "not-student" };
  if (user.blockedAt) return { sent: false, reason: "user-blocked" };
  if (user.gym.blockedAt) return { sent: false, reason: "gym-blocked" };

  const daysRemaining = Math.round(
    (user.nextPaymentDate.getTime() - today.getTime()) / DAY_MS
  );
  if (daysRemaining < 0 || daysRemaining > MAX_DAYS_AHEAD) {
    return { sent: false, reason: "out-of-range" };
  }

  if (
    user.lastDueNotifiedOn &&
    user.lastDueNotifiedOn.getTime() === today.getTime()
  ) {
    return { sent: false, reason: "already-notified-today" };
  }

  const body = bodyForDaysRemaining(daysRemaining, gymTerms(user.gym.kind).kindWord);
  const result = await sendPushToUser(userId, user.gym.name, body);

  if (result.sent > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastDueNotifiedOn: today },
    });
    return { sent: true, reason: `sent-day-${daysRemaining}` };
  }

  return { sent: false, reason: "no-active-subs" };
}
