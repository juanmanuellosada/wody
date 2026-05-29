import crypto from "crypto";
import type { GymSignupRequest, SignupRequestStatus } from "@prisma/client";

export function generateOnboardingToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function computeTokenExpiresAt(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export function isTokenExpired(req: Pick<GymSignupRequest, "tokenExpiresAt">): boolean {
  if (!req.tokenExpiresAt) return true;
  return req.tokenExpiresAt < new Date();
}

const VALID_TRANSITIONS: [SignupRequestStatus, SignupRequestStatus][] = [
  ["PENDING", "APPROVED"],
  ["PENDING", "REJECTED"],
  ["APPROVED", "COMPLETED"],
  ["APPROVED", "REJECTED"],
  ["APPROVED", "EXPIRED"],
  ["EXPIRED", "APPROVED"],
];

export function canTransition(from: SignupRequestStatus, to: SignupRequestStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
