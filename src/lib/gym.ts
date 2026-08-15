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

// Módulo de Turnos (agenda/reservas). Se prende por gym desde el panel de
// super-admin (Gym.bookingEnabled). Cada página de /turnos debe revalidar
// este flag contra la DB en cada request — no confiar en el valor propagado
// por el token de sesión (ver openspec/changes/add-turnos-booking/design.md D7).
export function hasBookingModule(bookingEnabled: boolean): boolean {
  return bookingEnabled;
}

// Módulo de Entrenamiento (WODs, RMs, rutinas). Prendido por default en todo
// gym existente y nuevo (Gym.trainingEnabled). Igual que hasBookingModule,
// cada página gateada debe revalidar contra la DB.
export function hasTrainingModule(trainingEnabled: boolean): boolean {
  return trainingEnabled;
}
