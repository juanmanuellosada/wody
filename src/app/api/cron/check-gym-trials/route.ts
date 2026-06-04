import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingPush, sendPersonalTrialEndingPush, sendSelfBillingDuePush } from "@/lib/push";
import { cleanupOldRateLimits } from "@/lib/rate-limit";
import { getTodayArgentina } from "@/lib/dates";
import type { Prisma } from "@prisma/client";

// Vercel Cron: 06:00 UTC (03:00 ART) daily — see vercel.json.
// Blocks gyms with expired trials and sends push notifications at milestone days.

const DAY_MS = 24 * 60 * 60 * 1000;
const PUSH_MILESTONES = new Set([7, 3, 1, 0]);

type PersonalUserPhaseCondition = Omit<
  Prisma.UserWhereInput,
  "gymId" | "role" | "canCreateOwnRoutines" | "deletedAt"
>;

async function findPersonalUsersInPhase(
  personalGymId: string,
  condition: PersonalUserPhaseCondition
) {
  return prisma.user.findMany({
    where: {
      gymId: personalGymId,
      role: "STUDENT",
      canCreateOwnRoutines: true,
      deletedAt: null,
      ...condition,
    },
    select: { id: true, email: true },
  });
}

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
  // Excludes selfManagedBilling gyms (they're governed by the manual due-date phase below).
  const expiredGyms = await prisma.gym.findMany({
    where: {
      trialEndsAt: { lt: now },
      mpPreapprovalId: null,
      paymentExempt: false,
      selfManagedBilling: false,
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

  // --- Phase 1.5: block gyms with failed payment past grace period ---
  // Excludes selfManagedBilling gyms (they never have mpPreapprovalId anyway).
  const FAILURE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
  const failureCutoff = new Date(now.getTime() - FAILURE_GRACE_MS);
  const paymentFailureGyms = await prisma.gym.findMany({
    where: {
      mpSubscriptionStatus: { in: ["paused", "cancelled"] },
      mpSubscriptionStatusChangedAt: { lt: failureCutoff },
      blockedAt: null,
      paymentExempt: false,
      selfManagedBilling: false,
      kind: { not: "PERSONAL" },
    },
    select: { id: true, slug: true },
  });
  const paymentFailureBlockedGymIds: string[] = [];
  for (const gym of paymentFailureGyms) {
    await prisma.gym.update({
      where: { id: gym.id },
      data: { blockedAt: now },
    });
    console.log("[check-gym-trials] Blocked for payment failure", { gymId: gym.id, slug: gym.slug });
    paymentFailureBlockedGymIds.push(gym.id);
  }

  // --- Personal phases ---
  const personalGym = await prisma.gym.findFirst({ where: { kind: "PERSONAL" } });

  const personalTrialBlockedUserIds: string[] = [];
  const personalPaymentFailureBlockedUserIds: string[] = [];
  const personalPushSummary: { userId: string; daysLeft: number; sent: number; removed: number }[] = [];

  if (!personalGym) {
    console.log("[check-gym-trials] No PERSONAL gym found — skipping Personal phases");
  } else {
    // --- Fase Personal 1: block Personal users with expired trial and no subscription ---
    const trialExpiredPersonalUsers = await findPersonalUsersInPhase(personalGym.id, {
      trialEndsAt: { lt: now },
      mpPreapprovalId: null,
      paymentExempt: false,
      blockedAt: null,
    });

    for (const user of trialExpiredPersonalUsers) {
      await prisma.user.update({ where: { id: user.id }, data: { blockedAt: now } });
      console.log("[check-gym-trials] Blocked Personal user for trial expiry", { userId: user.id });
      personalTrialBlockedUserIds.push(user.id);
    }

    // --- Fase Personal 1.5: block Personal users with failed payment past grace period ---
    const personalFailureCutoff = new Date(now.getTime() - FAILURE_GRACE_MS);
    const paymentFailurePersonalUsers = await findPersonalUsersInPhase(personalGym.id, {
      mpSubscriptionStatus: { in: ["paused", "cancelled"] },
      mpSubscriptionStatusChangedAt: { lt: personalFailureCutoff },
      blockedAt: null,
      paymentExempt: false,
    });

    for (const user of paymentFailurePersonalUsers) {
      await prisma.user.update({ where: { id: user.id }, data: { blockedAt: now } });
      console.log("[check-gym-trials] Blocked Personal user for payment failure", { userId: user.id });
      personalPaymentFailureBlockedUserIds.push(user.id);
    }

    // --- Fase Personal 2.5: push notifications at trial milestone days ---
    const trialingPersonalUsers = await prisma.user.findMany({
      where: {
        gymId: personalGym.id,
        role: "STUDENT",
        canCreateOwnRoutines: true,
        deletedAt: null,
        paymentExempt: false,
        mpSubscriptionStatus: { not: "authorized" },
        blockedAt: null,
        trialEndsAt: { not: null },
      },
      select: { id: true, trialEndsAt: true },
    });

    for (const user of trialingPersonalUsers) {
      const daysLeft = Math.ceil((user.trialEndsAt!.getTime() - now.getTime()) / DAY_MS);

      if (!PUSH_MILESTONES.has(daysLeft)) continue;

      const milestone = daysLeft as 7 | 3 | 1 | 0;
      try {
        const { sent, removed } = await sendPersonalTrialEndingPush(user.id, milestone);
        console.log("[check-gym-trials] Sent Personal trial push", { userId: user.id, daysLeft, sent, removed });
        personalPushSummary.push({ userId: user.id, daysLeft, sent, removed });
      } catch (err) {
        console.warn("[check-gym-trials] Failed to send Personal trial push", {
          userId: user.id,
          daysLeft,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
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

  // --- Phase 2.6: push reminders for self-managed billing gyms at milestone days ---
  const SELF_BILLING_MILESTONES = new Set([10, 7, 3, 1, 0]);
  const todayART = getTodayArgentina();

  const selfBillingGyms = await prisma.gym.findMany({
    where: {
      selfManagedBilling: true,
      paymentExempt: false,
      blockedAt: null,
      subscriptionNextPaymentDate: { not: null },
      kind: { not: "PERSONAL" },
    },
    select: { id: true, slug: true, subscriptionNextPaymentDate: true },
  });

  const selfBillingPushSummary: { gymId: string; daysLeft: number; sent: number; removed: number }[] = [];

  for (const gym of selfBillingGyms) {
    // subscriptionNextPaymentDate is guaranteed non-null by the where clause above
    const daysLeft = Math.round(
      (gym.subscriptionNextPaymentDate!.getTime() - todayART.getTime()) / DAY_MS
    );

    if (!SELF_BILLING_MILESTONES.has(daysLeft)) continue;

    try {
      const { totalSent, totalRemoved } = await sendSelfBillingDuePush(gym.id, daysLeft);
      console.log("[check-gym-trials] Sent self-billing reminder push", {
        gymId: gym.id,
        slug: gym.slug,
        daysLeft,
        totalSent,
        totalRemoved,
      });
      selfBillingPushSummary.push({ gymId: gym.id, daysLeft, sent: totalSent, removed: totalRemoved });
    } catch (err) {
      console.warn("[check-gym-trials] Failed to send self-billing reminder push", {
        gymId: gym.id,
        slug: gym.slug,
        daysLeft,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- Phase 2.7: block self-managed billing gyms past their grace period ---
  const selfBillingBlockedGymIds: string[] = [];

  const overdueGraceGyms = await prisma.gym.findMany({
    where: {
      selfManagedBilling: true,
      paymentExempt: false,
      blockedAt: null,
      subscriptionNextPaymentDate: { not: null },
      kind: { not: "PERSONAL" },
    },
    select: { id: true, slug: true, subscriptionNextPaymentDate: true, autoBlockAfterDays: true },
  });

  for (const gym of overdueGraceGyms) {
    const graceMs = gym.autoBlockAfterDays * DAY_MS;
    const blockAfter = new Date(gym.subscriptionNextPaymentDate!.getTime() + graceMs);
    if (now > blockAfter) {
      await prisma.gym.update({ where: { id: gym.id }, data: { blockedAt: now } });
      console.log("[check-gym-trials] Blocked self-managed gym past grace period", { gymId: gym.id, slug: gym.slug });
      selfBillingBlockedGymIds.push(gym.id);
    }
  }

  // --- Phase 3: expire signup tokens past their expiry date ---
  const { count: expiredCount } = await prisma.gymSignupRequest.updateMany({
    where: {
      status: "APPROVED",
      tokenExpiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });
  console.log("[check-gym-trials] Expired signup tokens", { count: expiredCount });

  // --- Phase 4: clean up old rate limit entries ---
  const cleanedRateLimits = await cleanupOldRateLimits(prisma);
  console.log("[check-gym-trials] Cleaned old rate limits", { count: cleanedRateLimits });

  return NextResponse.json({
    blockedCount: blockedGymIds.length,
    gymIds: blockedGymIds,
    paymentFailureBlockedCount: paymentFailureBlockedGymIds.length,
    paymentFailureBlockedGymIds,
    pushSummary,
    selfBillingPushSummary,
    selfBillingBlockedCount: selfBillingBlockedGymIds.length,
    selfBillingBlockedGymIds,
    personalTrialBlockedCount: personalTrialBlockedUserIds.length,
    personalTrialBlockedUserIds,
    personalPaymentFailureBlockedCount: personalPaymentFailureBlockedUserIds.length,
    personalPaymentFailureBlockedUserIds,
    personalPushSummary,
    expiredSignupRequestsCount: expiredCount,
    cleanedRateLimits,
  });
}
