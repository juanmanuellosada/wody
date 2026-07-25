import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingPush, sendPersonalTrialEndingPush, sendSelfBillingDuePush } from "@/lib/push";
import { sendPaymentDueGymEmail, sendPaymentDuePersonalEmail } from "@/lib/billing-emails";
import { cleanupOldRateLimits } from "@/lib/rate-limit";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import type { Prisma } from "@prisma/client";

// Vercel Cron: 06:00 UTC (03:00 ART) daily — see vercel.json.
// Blocks gyms with expired trials and sends push notifications at milestone days.

const DAY_MS = 24 * 60 * 60 * 1000;
const PUSH_MILESTONES = new Set([3, 1, 0]);
// Hitos del canal email — independientes de los hitos de la push (D3 del design de add-payment-due-emails).
const DUE_EMAIL_MILESTONES = new Set([2, 0]);
// Sentinela asignado a los usuarios Personal que nunca fueron cobrados a mano (ver personal-registration.ts).
const PERSONAL_NEXT_PAYMENT_SENTINEL = new Date("9999-12-31");

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
  const todayART = getTodayArgentina();

  // --- Phase 1: block gyms with expired trial and no subscription ---
  // Excludes selfManagedBilling gyms and gyms with a due-date loaded (governed by Phase 2.7).
  const expiredGyms = await prisma.gym.findMany({
    where: {
      trialEndsAt: { lt: now },
      mpPreapprovalId: null,
      paymentExempt: false,
      selfManagedBilling: false,
      subscriptionNextPaymentDate: null,
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
  // Excludes selfManagedBilling gyms and gyms with a due-date loaded (governed by Phase 2.7).
  const FAILURE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
  const failureCutoff = new Date(now.getTime() - FAILURE_GRACE_MS);
  const paymentFailureGyms = await prisma.gym.findMany({
    where: {
      mpSubscriptionStatus: { in: ["paused", "cancelled"] },
      mpSubscriptionStatusChangedAt: { lt: failureCutoff },
      blockedAt: null,
      paymentExempt: false,
      selfManagedBilling: false,
      subscriptionNextPaymentDate: null,
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
  let personalDueEmailsSent = 0;
  let personalDueEmailsFailed = 0;

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

      const milestone = daysLeft as 3 | 1 | 0;
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

    // --- Fase Personal 2.6: email de recordatorio de cuota (hitos {2, 0}) ---
    // Sólo alcanza a usuarios Personal cobrados a mano (nextPaymentDate real, no el centinela)
    // y que no estén en débito automático de MP.
    const personalDueCandidates = await prisma.user.findMany({
      where: {
        gymId: personalGym.id,
        role: "STUDENT",
        canCreateOwnRoutines: true,
        deletedAt: null,
        blockedAt: null,
        paymentExempt: false,
        email: { not: null },
        mpSubscriptionStatus: { not: "authorized" },
        nextPaymentDate: { not: PERSONAL_NEXT_PAYMENT_SENTINEL },
      },
      select: { id: true, name: true, email: true, nextPaymentDate: true, lastDueEmailedOn: true },
    });

    for (const user of personalDueCandidates) {
      const daysLeft = Math.round(
        (user.nextPaymentDate.getTime() - todayART.getTime()) / DAY_MS
      );
      if (!DUE_EMAIL_MILESTONES.has(daysLeft)) continue;
      if (user.lastDueEmailedOn && toInputDate(user.lastDueEmailedOn) === toInputDate(todayART)) continue;

      try {
        const result = await sendPaymentDuePersonalEmail(user, user.nextPaymentDate, daysLeft);
        if (result.ok) {
          await prisma.user.update({ where: { id: user.id }, data: { lastDueEmailedOn: todayART } });
          personalDueEmailsSent++;
        } else {
          personalDueEmailsFailed++;
        }
      } catch (err) {
        console.warn("[check-gym-trials] Failed to send Personal due email", {
          userId: user.id,
          daysLeft,
          error: err instanceof Error ? err.message : String(err),
        });
        personalDueEmailsFailed++;
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

    const milestone = daysLeft as 3 | 1 | 0;
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

  // --- Phase 2.6: reminders at milestone days for gyms with a due-date ---
  // Governed by subscriptionNextPaymentDate (independent of selfManagedBilling).
  // Dos canales con hitos independientes: push {10,7,3,1,0} y email {2,0} — el email
  // NO puede evaluarse dentro del `continue` de la push, porque 2 no es hito de la push.
  const SELF_BILLING_MILESTONES = new Set([10, 7, 3, 1, 0]);

  const selfBillingGyms = await prisma.gym.findMany({
    where: {
      subscriptionNextPaymentDate: { not: null },
      paymentExempt: false,
      blockedAt: null,
      kind: { not: "PERSONAL" },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      subscriptionNextPaymentDate: true,
      subscriptionMonthlyAmount: true,
      lastBillingEmailedOn: true,
    },
  });

  const selfBillingPushSummary: { gymId: string; daysLeft: number; sent: number; removed: number }[] = [];
  let gymDueEmailsSent = 0;
  let gymDueEmailsFailed = 0;

  for (const gym of selfBillingGyms) {
    // subscriptionNextPaymentDate is guaranteed non-null by the where clause above
    const daysLeft = Math.round(
      (gym.subscriptionNextPaymentDate!.getTime() - todayART.getTime()) / DAY_MS
    );

    if (SELF_BILLING_MILESTONES.has(daysLeft)) {
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

    if (
      DUE_EMAIL_MILESTONES.has(daysLeft) &&
      !(gym.lastBillingEmailedOn && toInputDate(gym.lastBillingEmailedOn) === toInputDate(todayART))
    ) {
      try {
        const { sent, failed } = await sendPaymentDueGymEmail(
          { id: gym.id, name: gym.name, slug: gym.slug, subscriptionMonthlyAmount: gym.subscriptionMonthlyAmount },
          gym.subscriptionNextPaymentDate!,
          daysLeft
        );
        gymDueEmailsSent += sent;
        gymDueEmailsFailed += failed;
        if (sent > 0) {
          await prisma.gym.update({ where: { id: gym.id }, data: { lastBillingEmailedOn: todayART } });
        }
      } catch (err) {
        console.warn("[check-gym-trials] Failed to send self-billing due email", {
          gymId: gym.id,
          slug: gym.slug,
          daysLeft,
          error: err instanceof Error ? err.message : String(err),
        });
        gymDueEmailsFailed++;
      }
    }
  }

  // --- Phase 2.7: block gyms with a due-date past their grace period ---
  // Governed by subscriptionNextPaymentDate (independent of selfManagedBilling).
  // Gyms with an authorized MP subscription are excluded (MP governs their billing).
  const selfBillingBlockedGymIds: string[] = [];

  const overdueGraceGyms = await prisma.gym.findMany({
    where: {
      subscriptionNextPaymentDate: { not: null },
      paymentExempt: false,
      blockedAt: null,
      mpSubscriptionStatus: { not: "authorized" },
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
    gymDueEmailsSent,
    gymDueEmailsFailed,
    selfBillingBlockedCount: selfBillingBlockedGymIds.length,
    selfBillingBlockedGymIds,
    personalTrialBlockedCount: personalTrialBlockedUserIds.length,
    personalTrialBlockedUserIds,
    personalPaymentFailureBlockedCount: personalPaymentFailureBlockedUserIds.length,
    personalPaymentFailureBlockedUserIds,
    personalPushSummary,
    personalDueEmailsSent,
    personalDueEmailsFailed,
    expiredSignupRequestsCount: expiredCount,
    cleanedRateLimits,
  });
}
