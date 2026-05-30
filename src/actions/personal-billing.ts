"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPersonalSubscriptionCheckoutUrl,
  cancelMpPreapproval,
} from "@/lib/mercadopago";

type ActionResult = { success: true } | { success: false; error: string };

async function getValidatedPersonalSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No autenticado");
  }
  if (session.user.role !== "STUDENT" || !session.user.canCreateOwnRoutines) {
    throw new Error("Acceso no autorizado");
  }

  const gym = await prisma.gym.findFirst({ where: { kind: "PERSONAL" } });
  if (!gym) {
    throw new Error("Gym personal no encontrado");
  }
  if (session.user.gymId !== gym.id) {
    throw new Error("Acceso no autorizado");
  }

  return { userId: session.user.id, gymId: gym.id };
}

export async function getMyPersonalSubscriptionStatus() {
  const { userId } = await getValidatedPersonalSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      trialEndsAt: true,
      paymentExempt: true,
      mpSubscriptionStatus: true,
      mpPreapprovalId: true,
    },
  });

  const daysLeftInTrial =
    user.trialEndsAt != null
      ? Math.ceil(
          (user.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        )
      : null;

  return {
    trialEndsAt: user.trialEndsAt,
    paymentExempt: user.paymentExempt,
    mpSubscriptionStatus: user.mpSubscriptionStatus,
    mpPreapprovalId: user.mpPreapprovalId,
    daysLeftInTrial,
  };
}

export async function getMyPersonalCheckoutUrl(): Promise<string> {
  const { userId } = await getValidatedPersonalSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { paymentExempt: true },
  });

  if (user.paymentExempt) {
    throw new Error("Tu cuenta está exenta, no hace falta configurar suscripción");
  }

  return getPersonalSubscriptionCheckoutUrl(userId);
}

export async function cancelMySubscription(): Promise<ActionResult> {
  const { userId } = await getValidatedPersonalSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { mpPreapprovalId: true, mpSubscriptionStatus: true },
  });

  if (user.mpPreapprovalId == null) {
    return { success: false, error: "No tenés ninguna suscripción activa para cancelar" };
  }

  if (user.mpSubscriptionStatus === "cancelled") {
    return { success: false, error: "Tu suscripción ya está cancelada" };
  }

  try {
    await cancelMpPreapproval(user.mpPreapprovalId);
  } catch {
    return { success: false, error: "Error al cancelar la suscripción" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      mpSubscriptionStatus: "cancelled",
      mpSubscriptionStatusChangedAt: new Date(),
    },
  });

  return { success: true };
}
