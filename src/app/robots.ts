import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Todo lo que vive detrás de login no aporta nada indexado: son páginas que le
 * devuelven un redirect al crawler y le queman presupuesto de rastreo. Dejamos
 * abierto solo lo público (landing, demo, landings de gym, beneficios).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/onboarding/",
          "/validar/",
          "/registro-personal/confirmar",
          // Rutas por gym que exigen sesión (`/*/` = cualquier gymSlug).
          "/*/dashboard",
          "/*/admin",
          "/*/caja",
          "/*/cuotas",
          "/*/ingresos",
          "/*/checkin",
          "/*/perfil",
          "/*/productos",
          "/*/turnos",
          "/*/login",
          "/*/recuperar",
          "/*/activar",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
