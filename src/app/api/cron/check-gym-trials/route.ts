import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingPush } from "@/lib/push";

// Vercel Cron: 06:00 UTC (03:00 ART) daily — see vercel.json.
// Blocks gyms with expired trials and sends push notifications at milestone days.

const DAY_MS = 24 * 60 * 60 * 1000;
const PUSH_MILESTONES = new Set([7, 3, 1, 0]);

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[check-gym-trials] CRON_SECRET env var is not set — refusing to run");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const isAuthorized =
    authHeader === `Bearer ${expected}` || vercelCron === "1";
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // --- Phase 1: block gyms with expired trial and no subscription ---
  const expiredGyms = await prisma.gym.findMany({
    where: {
      trialEndsAt: { lt: now },
      mpPreapprovalId: null,
      paymentExempt: false,
      blockedAt: null,
      kind: { not: "PERSONAL" },
    },
    select: { id: true, slug: true },
  });

  const blockedGymIds: string[] = [];
  for (const gym of expiredGyms) {
    await prisma.gym.update({
      where: { id: gym.id },
      data: { blockedAt: now },
    });
    console.log("[check-gym-trials] Blocked gym", { gymId: gym.id, slug: gym.slug });
    blockedGymIds.push(gym.id);
  }

  // --- Phase 2: send push notifications at trial milestone days ---
  const trialingGyms = await prisma.gym.findMany({
    where: {
      paymentExempt: false,
      mpSubscriptionStatus: { not: "authorized" },
      kind: { not: "PERSONAL" },
      blockedAt: null,
      trialEndsAt: { not: null },
    },
    select: { id: true, slug: true, trialEndsAt: true },
  });

  const pushSummary: { gymId: string; daysLeft: number; sent: number; removed: number }[] = [];

  for (const gym of trialingGyms) {
    // trialEndsAt is guaranteed non-null by the where clause above
    const daysLeft = Math.ceil((gym.trialEndsAt!.getTime() - now.getTime()) / DAY_MS);

    if (!PUSH_MILESTONES.has(daysLeft)) continue;

    const milestone = daysLeft as 7 | 3 | 1 | 0;
    try {
      const { totalSent, totalRemoved } = await sendTrialEndingPush(gym.id, milestone);
      console.log("[check-gym-trials] Sent trial push", {
        gymId: gym.id,
        slug: gym.slug,
        daysLeft,
        totalSent,
        totalRemoved,
      });
      pushSummary.push({ gymId: gym.id, daysLeft, sent: totalSent, removed: totalRemoved });
    } catch (err) {
      console.warn("[check-gym-trials] Failed to send trial push", {
        gymId: gym.id,
        slug: gym.slug,
        daysLeft,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    blockedCount: blockedGymIds.length,
    gymIds: blockedGymIds,
    pushSummary,
  });
}
