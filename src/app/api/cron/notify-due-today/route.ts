import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDueReminderIfNeeded, sendRoutineRenewalPush } from "@/lib/push";
import { getTodayArgentina, toInputDate } from "@/lib/dates";

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
      paymentExempt: false,
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

  // Phase 2: fixed routine renewal reminders for teachers (GYM-only)
  const RENEWAL_MILESTONES = new Set([0, 1, 3, 7]);
  const todayStr = toInputDate(today);

  // Find all active fixed routines of GYM gyms with renewal push subscriptions on the teacher,
  // where lastRenewalNotifiedOn is null or < today, ordered by student per teacher.
  // We fetch broadly and filter by milestone in JS to avoid complex SQL.
  const renewalCandidates = await prisma.fixedRoutine.findMany({
    where: {
      deletedAt: null,
      gym: { kind: "GYM" },
      teacher: { pushSubscriptions: { some: {} } },
      OR: [
        { lastRenewalNotifiedOn: null },
        { lastRenewalNotifiedOn: { lt: today } },
      ],
    },
    select: {
      id: true,
      assignedAt: true,
      renewAt: true,
      lastRenewalNotifiedOn: true,
      teacherId: true,
      studentId: true,
      student: { select: { name: true } },
    },
  });

  // Keep only the most recent active routine per student (the "active" one)
  const activeByStudent = new Map<string, typeof renewalCandidates[number]>();
  for (const r of renewalCandidates) {
    const existing = activeByStudent.get(r.studentId);
    if (!existing || r.assignedAt > existing.assignedAt) {
      activeByStudent.set(r.studentId, r);
    }
  }

  let renewalPushesSent = 0;

  for (const routine of activeByStudent.values()) {
    const renewAtStr = toInputDate(routine.renewAt);
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
    const renewDate = new Date(`${renewAtStr}T00:00:00.000Z`);
    const diffMs = renewDate.getTime() - todayDate.getTime();
    const daysLeft = Math.round(diffMs / DAY_MS);

    if (!RENEWAL_MILESTONES.has(daysLeft)) continue;

    // Dedup: already notified today
    if (
      routine.lastRenewalNotifiedOn &&
      toInputDate(routine.lastRenewalNotifiedOn) === todayStr
    ) {
      continue;
    }

    const result = await sendRoutineRenewalPush(
      routine.teacherId,
      routine.student.name,
      daysLeft
    );

    if (result.sent > 0) {
      await prisma.fixedRoutine.update({
        where: { id: routine.id },
        data: { lastRenewalNotifiedOn: today },
      });
      renewalPushesSent++;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    pushesSent: sent,
    renewalRemindersSent: renewalPushesSent,
  });
}
