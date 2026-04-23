import { createHmac } from "node:crypto";
import type { Role } from "@prisma/client";
import { getTodayArgentina } from "@/lib/dates";

// El QR del kiosk rota cada 5 minutos: el token es HMAC(bucket, secret),
// donde bucket es el timestamp (ms) truncado a 5 min. El server valida
// aceptando el bucket actual y el anterior (tolerancia ±1) para no
// rechazar scans hechos exactamente en el borde.

const BUCKET_MS = 5 * 60 * 1000;

function currentBucket(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / BUCKET_MS) * BUCKET_MS;
}

function sign(gymSlug: string, bucket: number): string {
  const secret = process.env.CHECKIN_TOKEN_SECRET;
  if (!secret) throw new Error("Missing CHECKIN_TOKEN_SECRET env var");
  return createHmac("sha256", secret)
    .update(`${gymSlug}:${bucket}`)
    .digest("base64url");
}

// Genera el token que el kiosk embebe en el QR ahora mismo.
export function generateCheckinToken(gymSlug: string): string {
  return sign(gymSlug, currentBucket());
}

// Valida un token recibido desde /checkin. Acepta bucket actual y anterior
// (10 minutos de ventana total).
export function validateCheckinToken(
  gymSlug: string,
  token: string,
  nowMs: number = Date.now()
): boolean {
  const bucket = currentBucket(nowMs);
  return token === sign(gymSlug, bucket) || token === sign(gymSlug, bucket - BUCKET_MS);
}

// Milisegundos hasta que el bucket actual cierre. Sirve para que el
// kiosk sepa cuándo refrescar el token.
export function msUntilNextBucket(nowMs: number = Date.now()): number {
  return currentBucket(nowMs) + BUCKET_MS - nowMs;
}

// Strict "al día": nextPaymentDate >= hoy (ART) y no bloqueado. Cualquier
// atraso manda el check-in a PENDING para que el operador decida.
type AlDiaInput = {
  role: Role;
  blockedAt: Date | null;
  nextPaymentDate: Date;
};

export function isUserAlDia(
  user: AlDiaInput,
  today: Date = getTodayArgentina()
): boolean {
  if (user.blockedAt) return false;
  if (user.role !== "STUDENT") return true; // profes/admins no tienen mora
  return user.nextPaymentDate.getTime() >= today.getTime();
}
