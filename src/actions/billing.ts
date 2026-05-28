"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubscriptionCheckoutUrl } from "@/lib/mercadopago";
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

export async function getMyCheckoutUrl(): Promise<string> {
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
    select: { paymentExempt: true },
  });

  if (gym.paymentExempt) {
    throw new Error("Tu gym está exento, no hace falta configurar suscripción");
  }

  return getSubscriptionCheckoutUrl(gymId);
}
