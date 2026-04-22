import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getTodayArgentina } from "@/lib/dates";

// Vercel Cron: 12:00 ART (15:00 UTC) daily — see vercel.json.
// Manda recordatorio a STUDENTs cuyo nextPaymentDate cae en [hoy, hoy+3]
// (ART), con copy personalizado según los días restantes. Skipped:
// alumnos bloqueados, gyms bloqueados y alumnos sin subs push.

const DAY_MS = 24 * 60 * 60 * 1000;

function bodyForDaysRemaining(days: number, word: "box" | "gym"): string {
  if (days <= 0) return `Tu cuota vence hoy. Pasá por tu ${word} para renovar.`;
  if (days === 1) return `Tu cuota vence mañana. Pasá por tu ${word} para renovar.`;
  return `Tu cuota vence en ${days} días. Pasá por tu ${word} para renovar.`;
}

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
  const rangeEnd = new Date(today.getTime() + 3 * DAY_MS);

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      blockedAt: null,
      gym: { blockedAt: null },
      nextPaymentDate: { gte: today, lte: rangeEnd },
      pushSubscriptions: { some: {} },
    },
    select: {
      id: true,
      name: true,
      nextPaymentDate: true,
      gym: { select: { name: true, kind: true } },
    },
  });

  let sent = 0;
  let removed = 0;
  for (const student of students) {
    const daysRemaining = Math.round(
      (student.nextPaymentDate.getTime() - today.getTime()) / DAY_MS
    );
    const word = student.gym.kind === "GYM" ? "gym" : "box";
    const body = bodyForDaysRemaining(daysRemaining, word);

    const result = await sendPushToUser(student.id, student.gym.name, body);
    sent += result.sent;
    removed += result.removed;
  }

  return NextResponse.json({
    ok: true,
    candidates: students.length,
    pushesSent: sent,
    expiredSubsRemoved: removed,
  });
}
