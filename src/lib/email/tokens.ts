import crypto from "crypto";
import type { VerificationTokenType, VerificationToken, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function generateToken(): { plain: string; hash: string } {
  const plain = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

export function hashToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

type ConsumeTokenResult =
  | { ok: true; token: VerificationToken; user: User }
  | { ok: false; reason: "NOT_FOUND" | "CONSUMED" | "EXPIRED" | "WRONG_GYM" };

export async function consumeToken({
  tokenHash,
  type,
  gymSlug,
}: {
  tokenHash: string;
  type: VerificationTokenType;
  gymSlug: string;
}): Promise<ConsumeTokenResult> {
  return prisma.$transaction(async (tx) => {
    const token = await tx.verificationToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { gym: true } } },
    });

    if (!token || token.type !== type) {
      return { ok: false, reason: "NOT_FOUND" as const };
    }
    if (token.expiresAt < new Date()) {
      return { ok: false, reason: "EXPIRED" as const };
    }
    if (token.user.gym.slug !== gymSlug) {
      return { ok: false, reason: "WRONG_GYM" as const };
    }

    const updated = await tx.verificationToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (updated.count === 0) {
      return { ok: false, reason: "CONSUMED" as const };
    }

    // Return the consumed token and its user (without the gym relation,
    // which is not part of the VerificationToken model type).
    const { user: _userWithGym, ...tokenFields } = token;
    const { gym: _gym, ...userFields } = _userWithGym;

    return {
      ok: true,
      token: { ...tokenFields, consumedAt: new Date() },
      user: userFields,
    };
  });
}
