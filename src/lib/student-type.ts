import type { GymKind, StudentType } from "@prisma/client";

export const STUDENT_TYPE_LABELS: Record<StudentType, string> = {
  GENERAL: "General",
  PERSONALIZED: "Personalizado",
  MUSCULACION_LIBRE: "Musculación libre",
};

/** Tipos de alumno ofrecidos como opción de filtro, según el kind del gym.
 * MUSCULACION_LIBRE solo existe en gyms kind = GYM. */
export function studentTypeOptions(gymKind: GymKind | null | undefined): StudentType[] {
  const base: StudentType[] = ["GENERAL", "PERSONALIZED"];
  if (gymKind === "GYM") base.push("MUSCULACION_LIBRE");
  return base;
}
