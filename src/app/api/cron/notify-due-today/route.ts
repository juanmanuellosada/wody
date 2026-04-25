import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDueReminderIfNeeded } from "@/lib/push";
import { getTodayArgentina } from "@/lib/dates";

// Vercel Cron: 12:00 ART (15:00 UTC) daily — see vercel.json.
// Recorre alumnos cuyo nextPaymentDate cae en [hoy, hoy+2] (ART) y todavía
// no fueron notificados hoy. El envío + dedup están en sendDueReminderIfNeeded;
// el cron es solo el loop. Cuando el alumno se loguea (ver layout del gym)
// puede disparar el mismo helper, lo que ocurra primero gana.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS_AHEAD = 2;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const isAuthorized =
    (expected && auth === `Bearer ${expected}`) || vercelCron === "1";
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayArgentina();
  const rangeEnd = new Date(today.getTime() + MAX_DAYS_AHEAD * DAY_MS);

  const candidates = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      deletedAt: null,
      blockedAt: null,
      gym: { blockedAt: null },
      nextPaymentDate: { gte: today, lte: rangeEnd },
      pushSubscriptions: { some: {} },
      OR: [
        { lastDueNotifiedOn: null },
        { lastDueNotifiedOn: { lt: today } },
      ],
    },
    select: { id: true },
  });

  let sent = 0;
  for (const { id } of candidates) {
    const result = await sendDueReminderIfNeeded(id, today);
    if (result.sent) sent++;
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    pushesSent: sent,
  });
}
