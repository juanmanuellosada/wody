"use server";

import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Coupon, CouponRule, User } from "@prisma/client";

export type AvailableCoupon = {
  id: string;
  slug: string;
  name: string;
  description: string;
  instagramHandle: string;
  instagramUrl: string;
  logoKey: string | null;
  rule: CouponRule;
  /** Existing PENDING code for the current user, if any. */
  pendingCode: string | null;
  /** If true, the user has already consumed this coupon and cannot get another. */
  blocked: boolean;
  /** Present when blocked — explains why. */
  blockedReason: string | null;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  // 8 chars, split as XXXX-XXXX. ~32^8 = ~1.1e12 combinations.
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `WODY-${out}`;
}

export async function listAvailableCoupons(): Promise<AvailableCoupon[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;

  const coupons = await prisma.coupon.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const couponIds = coupons.map((c) => c.id);
  if (couponIds.length === 0) return [];

  // All this user's redemptions for these coupons.
  const userRedemptions = await prisma.couponRedemption.findMany({
    where: { userId, couponId: { in: couponIds } },
  });

  // Globally consumed redemptions for ONCE_GLOBAL coupons.
  const onceGlobalCoupons = coupons
    .filter((c) => c.rule === "ONCE_GLOBAL")
    .map((c) => c.id);

  const globalConsumed =
    onceGlobalCoupons.length > 0
      ? await prisma.couponRedemption.findMany({
          where: {
            couponId: { in: onceGlobalCoupons },
            status: "CONSUMED",
          },
          select: { couponId: true },
        })
      : [];

  const globalConsumedSet = new Set(globalConsumed.map((r) => r.couponId));

  return coupons.map((c) => buildAvailable(c, userRedemptions, globalConsumedSet));
}

function buildAvailable(
  c: Coupon,
  userRedemptions: { couponId: string; status: "PENDING" | "CONSUMED"; code: string }[],
  globalConsumed: Set<string>
): AvailableCoupon {
  const userForCoupon = userRedemptions.filter((r) => r.couponId === c.id);
  const userPending = userForCoupon.find((r) => r.status === "PENDING");
  const userConsumed = userForCoupon.find((r) => r.status === "CONSUMED");

  let blocked = false;
  let blockedReason: string | null = null;

  if (c.rule === "ONCE_PER_USER" && userConsumed) {
    blocked = true;
    blockedReason = "Ya canjeaste este beneficio.";
  } else if (c.rule === "ONCE_GLOBAL" && globalConsumed.has(c.id)) {
    // If the user has no pending code for this coupon, hide it entirely by
    // blocking. If they had pending, it would still show (they may use it).
    if (!userPending) {
      blocked = true;
      blockedReason = "Beneficio agotado.";
    }
  }

  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    instagramHandle: c.instagramHandle,
    instagramUrl: c.instagramUrl,
    logoKey: c.logoKey,
    rule: c.rule,
    pendingCode: userPending?.code ?? null,
    blocked,
    blockedReason,
  };
}

export type GenerateResult =
  | { success: true; code: string }
  | { success: false; error: string };

export async function generateRedemption(
  couponSlug: string
): Promise<GenerateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tenés que iniciar sesión." };
  }
  const userId = session.user.id;

  const coupon = await prisma.coupon.findUnique({ where: { slug: couponSlug } });
  if (!coupon || !coupon.active) {
    return { success: false, error: "Beneficio no disponible." };
  }

  // Reuse a PENDING code if one exists for this user+coupon.
  const existingPending = await prisma.couponRedemption.findFirst({
    where: { userId, couponId: coupon.id, status: "PENDING" },
  });
  if (existingPending) {
    return { success: true, code: existingPending.code };
  }

  if (coupon.rule === "ONCE_PER_USER") {
    const prior = await prisma.couponRedemption.findFirst({
      where: { userId, couponId: coupon.id, status: "CONSUMED" },
    });
    if (prior) {
      return { success: false, error: "Ya canjeaste este beneficio." };
    }
  }

  if (coupon.rule === "ONCE_GLOBAL") {
    const consumed = await prisma.couponRedemption.findFirst({
      where: { couponId: coupon.id, status: "CONSUMED" },
    });
    if (consumed) {
      return { success: false, error: "Beneficio agotado." };
    }
  }

  // Generate unique code (retry on collision — extremely rare).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await prisma.couponRedemption.create({
        data: {
          code,
          couponId: coupon.id,
          userId,
          status: "PENDING",
        },
      });
      return { success: true, code };
    } catch {
      // unique constraint collision — retry
    }
  }

  return { success: false, error: "No se pudo generar el código. Reintentá." };
}

export type RedemptionLookup =
  | {
      found: false;
    }
  | {
      found: true;
      code: string;
      status: "PENDING" | "CONSUMED";
      consumedAt: Date | null;
      createdAt: Date;
      wasJustConsumed: boolean;
      coupon: {
        name: string;
        description: string;
        instagramHandle: string;
        instagramUrl: string;
        logoKey: string | null;
      };
      user: {
        name: string;
        gymName: string;
      };
    };

export async function getRedemptionByCode(
  rawCode: string
): Promise<RedemptionLookup> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { found: false };

  const redemption = await prisma.couponRedemption.findUnique({
    where: { code },
    include: {
      coupon: true,
      user: { include: { gym: true } },
    },
  });

  if (!redemption) return { found: false };

  let wasJustConsumed = false;
  let status = redemption.status;
  let consumedAt = redemption.consumedAt;

  if (status === "PENDING") {
    const now = new Date();
    await prisma.couponRedemption.update({
      where: { id: redemption.id },
      data: { status: "CONSUMED", consumedAt: now },
    });
    status = "CONSUMED";
    consumedAt = now;
    wasJustConsumed = true;
  }

  return {
    found: true,
    code: redemption.code,
    status,
    consumedAt,
    createdAt: redemption.createdAt,
    wasJustConsumed,
    coupon: {
      name: redemption.coupon.name,
      description: redemption.coupon.description,
      instagramHandle: redemption.coupon.instagramHandle,
      instagramUrl: redemption.coupon.instagramUrl,
      logoKey: redemption.coupon.logoKey,
    },
    user: {
      name: (redemption.user as User).name,
      gymName: redemption.user.gym.name,
    },
  };
}
