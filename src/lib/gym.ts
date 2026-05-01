import { GymKind } from "@prisma/client";

export function isPersonalGym(kind: GymKind): boolean {
  return kind === "PERSONAL";
}

/**
 * Build a gym-prefixed path.
 * gymPath("unidos-garage", "/dashboard/athlete") → "/unidos-garage/dashboard/athlete"
 */
export function gymPath(slug: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${slug}${normalizedPath}`;
}

// Gyms donde el kiosk de ingresos (QR + control de acceso) está deshabilitado.
// Para estos gyms se ocultan los links del Navbar y las rutas /ingresos,
// /ingresos/historial y /checkin devuelven 404.
const GYMS_WITHOUT_ACCESS_CONTROL = new Set<string>(["unidos-garage"]);

export function hasAccessControl(gymSlug: string): boolean {
  return !GYMS_WITHOUT_ACCESS_CONTROL.has(gymSlug);
}

// Gyms donde el FAB de "Contactar por WhatsApp" (alumno → profe) está
// deshabilitado. Se oculta el botón para los STUDENT.
const GYMS_WITHOUT_TEACHER_WHATSAPP = new Set<string>(["atlas-gym"]);

export function hasTeacherWhatsAppContact(gymSlug: string): boolean {
  return !GYMS_WITHOUT_TEACHER_WHATSAPP.has(gymSlug);
}
