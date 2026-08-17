/**
 * Host canónico del sitio.
 *
 * `wody.com.ar` responde con un redirect a `www.wody.com.ar`, así que todo lo
 * que ve un crawler —canonical, sitemap, Open Graph— tiene que apuntar al www.
 * Si no, cada URL existe dos veces para Google y las señales se parten entre
 * las dos versiones. Misma normalización que ya hacen los templates de email.
 */
const rawUrl = process.env.APP_URL ?? "https://www.wody.com.ar";

export const SITE_URL = rawUrl
  .replace("://wody.com.ar", "://www.wody.com.ar")
  .replace(/\/$/, "");

export const SITE_NAME = "Wody";

export const SITE_TITLE =
  "Wody — Software de gestión para gimnasios y boxes de CrossFit";

export const SITE_DESCRIPTION =
  "Plataforma argentina para gestionar rutinas y WODs, RMs, reserva de turnos, control de acceso con QR y cobro de cuotas con Mercado Pago. 7 días de prueba gratis, sin tarjeta.";
