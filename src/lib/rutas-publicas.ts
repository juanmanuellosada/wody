import type { MetadataRoute } from "next";

/**
 * Fuente única de las páginas públicas que no cuelgan de un `[gymSlug]`.
 *
 * Existe porque `src/proxy.ts` asume que el primer segmento de cualquier URL es
 * un gymSlug y devuelve 404 si no lo reconoce. Cada página nueva de marketing
 * tiene que estar acá, o no se ve en producción aunque compile perfecto.
 * Teniéndola en un solo lugar, el proxy y el sitemap no se pueden desincronizar.
 */

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

export const PAGINAS_PUBLICAS: Array<{
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
}> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/software-gestion-gimnasios", priority: 0.9, changeFrequency: "monthly" },
  { path: "/control-de-acceso-gimnasio-qr", priority: 0.9, changeFrequency: "monthly" },
  { path: "/comparativa", priority: 0.8, changeFrequency: "monthly" },
  { path: "/demo", priority: 0.9, changeFrequency: "monthly" },
  { path: "/demo/teacher", priority: 0.6, changeFrequency: "monthly" },
  { path: "/demo/admin", priority: 0.6, changeFrequency: "monthly" },
  { path: "/demo/student", priority: 0.6, changeFrequency: "monthly" },
  { path: "/registro-personal", priority: 0.7, changeFrequency: "monthly" },
];

/**
 * Primeros segmentos que el proxy nunca debe interpretar como gymSlug.
 * Incluye los de sistema (api, admin, ...) y los de las páginas públicas.
 */
export const SEGMENTOS_RESERVADOS = new Set<string>([
  "api",
  "admin",
  "demo",
  "validar",
  "registro-personal",
  "onboarding",
  ...PAGINAS_PUBLICAS.map((p) => p.path.split("/")[1]).filter(Boolean),
]);
