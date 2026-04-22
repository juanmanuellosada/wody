import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { getTodayArgentina } from "@/lib/dates";

// Vercel Cron: 9:00 ART (12:00 UTC) daily — see vercel.json.
// Sends two kinds of reminders to STUDENT users whose nextPaymentDate falls
// today or 3 days from today (Argentina time):
//   - "Tu cuota vence hoy. Pasá por tu {box|gym} para renovar."
//   - "Tu cuota vence en 3 días. Pasá por tu {box|gym} para renovar."
// Skipped: blocked users, users in blocked gyms, users without push subs.

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
  const dayMs = 24 * 60 * 60 * 1000;
  const todayDate = new Date(today.getTime());
  const inThreeDays = new Date(today.getTime() + 3 * dayMs);

  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      blockedAt: null,
      gym: { blockedAt: null },
      nextPaymentDate: { in: [todayDate, inThreeDays] },
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
    const isToday = student.nextPaymentDate.getTime() === todayDate.getTime();
    const word = student.gym.kind === "GYM" ? "gym" : "box";
    const body = isToday
      ? `Tu cuota vence hoy. Pasá por tu ${word} para renovar.`
      : `Tu cuota vence en 3 días. Pasá por tu ${word} para renovar.`;

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
