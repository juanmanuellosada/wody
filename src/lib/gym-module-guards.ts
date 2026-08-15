import { prisma } from "@/lib/prisma";

/**
 * Revalidación de flags de módulo (bookingEnabled / trainingEnabled) contra
 * la DB, para usar en las páginas server de /turnos (grupo 3 de
 * openspec/changes/add-turnos-booking/tasks.md) y en cualquier página server
 * de WODs/RMs/rutinas que deba rechazar el acceso cuando trainingEnabled es
 * false.
 *
 * Por qué existe: el flag propagado en el token de sesión puede quedar stale
 * si un super-admin lo apaga a mitad de sesión (ver
 * openspec/changes/add-turnos-booking/specs/gym-modules/spec.md, requirement
 * "El guard de página revalida el flag contra la base de datos"). Cada
 * página gateada debe leer el valor vigente en cada request.
 *
 * Patrón de uso (igual que src/app/[gymSlug]/productos/page.tsx:31-38): la
 * página decide cómo rechazar el acceso (redirect, notFound) según su rol.
 *
 *   const enabled = await isBookingModuleEnabled(gymSlug);
 *   if (!enabled) redirect(gymPath(gymSlug, "/dashboard/athlete"));
 *
 * Server-only: usa Prisma directamente. No importar desde un componente
 * "use client" (a diferencia de hasBookingModule/hasTrainingModule en
 * src/lib/gym.ts, que son predicados puros seguros para el cliente).
 */
export async function isBookingModuleEnabled(gymSlug: string): Promise<boolean> {
  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { bookingEnabled: true },
  });
  return gym?.bookingEnabled ?? false;
}

export async function isTrainingModuleEnabled(gymSlug: string): Promise<boolean> {
  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { trainingEnabled: true },
  });
  return gym?.trainingEnabled ?? false;
}
