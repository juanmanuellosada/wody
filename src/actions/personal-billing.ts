"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createPersonalSubscription,
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

type SubscribePersonalResult =
  | { success: true; initPoint: string }
  | { success: false; error: string };

/**
 * Creates a MercadoPago pending preapproval for the Personal user and returns
 * the init_point URL so the user can authorize the subscription via redirect.
 * Persists mpPreapprovalId and mpSubscriptionStatus only if the creation succeeds.
 */
export async function subscribePersonal(): Promise<SubscribePersonalResult> {
  const { userId } = await getValidatedPersonalSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { paymentExempt: true, trialEndsAt: true },
  });

  if (user.paymentExempt) {
    return { success: false, error: "Tu cuenta está exenta, no hace falta configurar suscripción" };
  }

  const result = await createPersonalSubscription({
    userId,
    trialEndsAt: user.trialEndsAt,
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      mpPreapprovalId: result.mpPreapprovalId,
      mpSubscriptionStatus: result.mpSubscriptionStatus,
      mpSubscriptionStatusChangedAt: new Date(),
    },
  });

  return { success: true, initPoint: result.initPoint };
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
