// Slugs que no pueden usarse como identificador de gym.
// Cada vez que se agrega una ruta pública nueva a la app (ej: /nueva-ruta),
// hay que sumarla a este set para evitar colisiones con futuros gyms.
export const RESERVED_SLUGS = new Set<string>([
  "personal",
  "admin",
  "api",
  "app",
  "validar",
  "demo",
  "instalar",
  "registro-personal",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
