"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

const MIN_HOURS = 1;
const MAX_HOURS = 72;

// Antelación del recordatorio de turno, configurable por el admin del gym
// (a diferencia de bookingEnabled/trainingEnabled, que solo cambia el
// super-admin) — ver openspec/changes/add-turnos-booking/design.md D8.
export async function updateReminderLeadHours(hours: number): Promise<ActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  if (!gymId) {
    return { success: false, error: "No hay un gym asociado a esta sesión." };
  }

  if (!Number.isInteger(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
    return { success: false, error: `Ingresá un número entero de horas entre ${MIN_HOURS} y ${MAX_HOURS}.` };
  }

  await prisma.gym.update({
    where: { id: gymId },
    data: { reminderLeadHours: hours },
  });

  return { success: true };
}
