import { randomBytes } from "node:crypto";

// Token aleatorio de 32 bytes en base64url. Se guarda raw en User.qrToken
// (unique index). Si el DB leakea, el token se filtra junto con el resto
// del PII — pero el token solo sirve para pullear la ficha del socio en
// el kiosk; el gate real de acceso es el operador humano.
export function generateQrToken(): string {
  return randomBytes(32).toString("base64url");
}

// Formato del contenido del QR. El prefijo es defensa en profundidad: el
// kiosk puede rechazar scans que no tengan este formato antes de buscar
// en DB.
export function qrPayload(gymSlug: string, token: string): string {
  return `WODY:${gymSlug}:${token}`;
}

// Parsea un scan. Retorna null si el formato no matchea. Si matchea,
// devuelve slug y token — el caller valida que el slug corresponda al
// gym del kiosk.
export function parseQrPayload(
  input: string
): { slug: string; token: string } | null {
  const parts = input.split(":");
  if (parts.length !== 3 || parts[0] !== "WODY") return null;
  const slug = parts[1];
  const token = parts[2];
  if (!slug || !token) return null;
  return { slug, token };
}
