"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGymSubscription, cancelMpPreapproval, describeMpError } from "@/lib/mercadopago";
import type { MpSubscriptionStatus } from "@/lib/mercadopago";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscriptionStatus = {
  trialEndsAt: Date | null;
  paymentExempt: boolean;
  mpSubscriptionStatus: MpSubscriptionStatus | null;
  mpPreapprovalId: string | null;
  daysLeftInTrial: number | null;
  subscriptionNextPaymentDate: Date | null;
  selfManagedBilling: boolean;
  subscriptionMonthlyAmount: number | null;
};

export async function getMySubscriptionStatus(): Promise<SubscriptionStatus> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("forbidden");
  }
  const gymId = session.user.gymId;
  if (!gymId) {
    throw new Error("No gym associated with this session");
  }

  const gym = await prisma.gym.findUniqueOrThrow({
    where: { id: gymId },
    select: {
      trialEndsAt: true,
      paymentExempt: true,
      mpSubscriptionStatus: true,
      mpPreapprovalId: true,
      subscriptionNextPaymentDate: true,
      selfManagedBilling: true,
      subscriptionMonthlyAmount: true,
    },
  });

  const daysLeftInTrial =
    gym.trialEndsAt != null
      ? Math.ceil((gym.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

  return {
    trialEndsAt: gym.trialEndsAt,
    paymentExempt: gym.paymentExempt,
    mpSubscriptionStatus: (gym.mpSubscriptionStatus as MpSubscriptionStatus | null) ?? null,
    mpPreapprovalId: gym.mpPreapprovalId,
    daysLeftInTrial,
    subscriptionNextPaymentDate: gym.subscriptionNextPaymentDate,
    selfManagedBilling: gym.selfManagedBilling,
    subscriptionMonthlyAmount: gym.subscriptionMonthlyAmount,
  };
}

type SubscribeGymResult =
  | { success: true; initPoint: string }
  | { success: false; error: string };

/**
 * Creates a MercadoPago pending preapproval for the gym and returns the
 * init_point URL so the user can authorize the subscription via redirect.
 * Persists mpPreapprovalId and mpSubscriptionStatus only if the creation succeeds.
 */
export async function subscribeGym(payerEmailInput: string): Promise<SubscribeGymResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acceso no autorizado" };
  }
  const gymId = session.user.gymId;
  if (!gymId) {
    return { success: false, error: "No hay un gym asociado a esta sesión" };
  }

  const payerEmail = payerEmailInput.trim();
  if (!payerEmail || !EMAIL_REGEX.test(payerEmail)) {
    return {
      success: false,
      error: "Ingresá un email válido de tu cuenta de Mercado Pago.",
    };
  }

  const gym = await prisma.gym.findUniqueOrThrow({
    where: { id: gymId },
    select: { paymentExempt: true, trialEndsAt: true, mpPreapprovalId: true },
  });

  if (gym.mpPreapprovalId) {
    try {
      await cancelMpPreapproval(gym.mpPreapprovalId);
    } catch (err) {
      console.error("[billing] subscribeGym: failed to cancel previous preapproval", {
        gymId,
        preapprovalId: gym.mpPreapprovalId,
        error: describeMpError(err),
      });
    }
  }

  const result = await createGymSubscription({
    gymId,
    trialEndsAt: gym.trialEndsAt,
    payerEmail,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await prisma.gym.update({
    where: { id: gymId },
    data: {
      mpPreapprovalId: result.mpPreapprovalId,
      mpSubscriptionStatus: result.mpSubscriptionStatus,
      mpSubscriptionStatusChangedAt: new Date(),
    },
  });

  return { success: true, initPoint: result.initPoint };
}
