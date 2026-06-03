"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGymSubscription } from "@/lib/mercadopago";
import type { MpSubscriptionStatus } from "@/lib/mercadopago";

export type SubscriptionStatus = {
  trialEndsAt: Date | null;
  paymentExempt: boolean;
  mpSubscriptionStatus: MpSubscriptionStatus | null;
  mpPreapprovalId: string | null;
  daysLeftInTrial: number | null;
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
  };
}

type SubscribeGymResult = { success: true } | { success: false; error: string };

/**
 * Creates a MercadoPago preapproval for the gym using a card token obtained
 * via MP Bricks in the client. Persists mpPreapprovalId and mpSubscriptionStatus
 * only if the creation succeeds.
 */
export async function subscribeGym(params: {
  cardTokenId: string;
  payerEmail: string;
}): Promise<SubscribeGymResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acceso no autorizado" };
  }
  const gymId = session.user.gymId;
  if (!gymId) {
    return { success: false, error: "No hay un gym asociado a esta sesión" };
  }

  const gym = await prisma.gym.findUniqueOrThrow({
    where: { id: gymId },
    select: { paymentExempt: true, trialEndsAt: true },
  });

  const result = await createGymSubscription({
    cardTokenId: params.cardTokenId,
    payerEmail: params.payerEmail,
    gymId,
    trialEndsAt: gym.trialEndsAt,
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

  return { success: true };
}
