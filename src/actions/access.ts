"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { validateCheckinToken, isUserAlDia } from "@/lib/checkin";

export type CheckinResult =
  | { success: true; logId: string; state: "PENDING" | "GRANTED" }
  | { success: false; error: string };

// Llamada por /checkin cuando un alumno scanea el QR del kiosk. Crea un
// AccessLog con estado GRANTED si el alumno está al día (auto-grant), o
// PENDING si no — en ese caso el operador decide desde /ingresos.
export async function createCheckin(
  gymSlug: string,
  token: string
): Promise<CheckinResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Tenés que iniciar sesión." };
  }

  if (session.user.gymSlug !== gymSlug) {
    return { success: false, error: "Gym no coincide con la sesión." };
  }

  if (!validateCheckinToken(gymSlug, token)) {
    return { success: false, error: "Código vencido. Escaneá el QR de nuevo." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      blockedAt: true,
      nextPaymentDate: true,
      gymId: true,
      gym: { select: { blockedAt: true } },
    },
  });

  if (!user) {
    return { success: false, error: "Usuario no encontrado." };
  }

  if (user.blockedAt || user.gym.blockedAt) {
    // No deberían llegar acá (el layout los bloquea), pero por las dudas.
    return { success: false, error: "Tu cuenta no puede ingresar." };
  }

  const autoGrant = isUserAlDia({
    role: user.role,
    blockedAt: user.blockedAt,
    nextPaymentDate: user.nextPaymentDate,
  });

  const log = await prisma.accessLog.create({
    data: {
      gymId: user.gymId,
      userId: user.id,
      state: autoGrant ? "GRANTED" : "PENDING",
      decidedAt: autoGrant ? new Date() : null,
    },
  });

  revalidatePath(gymPath(gymSlug, "/ingresos"));
  return { success: true, logId: log.id, state: autoGrant ? "GRANTED" : "PENDING" };
}

export type DecideResult = { success: true } | { success: false; error: string };

// Llamada por el operador (ACCESS/ADMIN) desde el kiosk para resolver una
// AccessLog en PENDING. No se acepta razón — ambos botones son single-click.
export async function decideCheckin(
  logId: string,
  decision: "GRANT" | "DENY"
): Promise<DecideResult> {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ACCESS" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const log = await prisma.accessLog.findUnique({
    where: { id: logId },
    select: { gymId: true, state: true },
  });
  if (!log || log.gymId !== session.user.gymId) {
    return { success: false, error: "Log no encontrado." };
  }
  if (log.state !== "PENDING") {
    return { success: false, error: "Este ingreso ya fue resuelto." };
  }

  await prisma.accessLog.update({
    where: { id: logId },
    data: {
      state: decision === "GRANT" ? "GRANTED" : "DENIED",
      decidedById: session.user.id,
      decidedAt: new Date(),
    },
  });

  revalidatePath(gymPath(session.user.gymSlug, "/ingresos"));
  return { success: true };
}
