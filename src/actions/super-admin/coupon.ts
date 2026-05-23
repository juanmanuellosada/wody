"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPublicImage, deleteBlobByUrl } from "@/lib/blob";
import type { CouponRule } from "@prisma/client";

async function assertSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    throw new Error("forbidden");
  }
}

export type CouponRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  instagramHandle: string;
  instagramUrl: string;
  logoKey: string | null;
  rule: CouponRule;
  active: boolean;
  sortOrder: number;
  requiresConsumedSlug: string | null;
  hideWhenConsumed: boolean;
  expiresAt: Date | null;
  fixedCode: string | null;
  websiteUrl: string | null;
  restrictions: string | null;
  createdAt: Date;
  redemptionCount: number;
};

export async function listAllCoupons(): Promise<CouponRow[]> {
  await assertSuperAdmin();
  const coupons = await prisma.coupon.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { redemptions: true } } },
  });
  return coupons.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    instagramHandle: c.instagramHandle,
    instagramUrl: c.instagramUrl,
    logoKey: c.logoKey,
    rule: c.rule,
    active: c.active,
    sortOrder: c.sortOrder,
    requiresConsumedSlug: c.requiresConsumedSlug,
    hideWhenConsumed: c.hideWhenConsumed,
    expiresAt: c.expiresAt,
    fixedCode: c.fixedCode,
    websiteUrl: c.websiteUrl,
    restrictions: c.restrictions,
    createdAt: c.createdAt,
    redemptionCount: c._count.redemptions,
  }));
}

export type CreateCouponInput = {
  slug: string;
  name: string;
  description: string;
  instagramHandle: string;
  instagramUrl: string;
  rule: CouponRule;
  active: boolean;
  sortOrder: number;
  requiresConsumedSlug?: string;
  hideWhenConsumed: boolean;
  expiresAt?: string;
  fixedCode?: string;
  websiteUrl?: string;
  restrictions?: string;
  logoFile?: File;
};

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function createCoupon(input: CreateCouponInput): Promise<ActionResult> {
  await assertSuperAdmin();

  const existing = await prisma.coupon.findUnique({ where: { slug: input.slug } });
  if (existing) {
    return { success: false, error: "El slug ya existe. Elegí uno diferente." };
  }

  let logoKey: string | null = null;
  if (input.logoFile) {
    try {
      const result = await uploadPublicImage(input.logoFile, "coupons");
      logoKey = result.url;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Error al subir el logo." };
    }
  }

  await prisma.coupon.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      instagramHandle: input.instagramHandle,
      instagramUrl: input.instagramUrl,
      rule: input.rule,
      active: input.active,
      sortOrder: input.sortOrder,
      requiresConsumedSlug: input.requiresConsumedSlug || null,
      hideWhenConsumed: input.hideWhenConsumed,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      fixedCode: input.fixedCode || null,
      websiteUrl: input.websiteUrl || null,
      restrictions: input.restrictions || null,
      logoKey,
    },
  });

  return { success: true };
}

export type UpdateCouponInput = Omit<CreateCouponInput, "slug"> & {
  id: string;
};

export async function updateCoupon(input: UpdateCouponInput): Promise<ActionResult> {
  await assertSuperAdmin();

  const coupon = await prisma.coupon.findUnique({ where: { id: input.id } });
  if (!coupon) {
    return { success: false, error: "Cupón no encontrado." };
  }

  let logoKey = coupon.logoKey;
  if (input.logoFile) {
    try {
      const result = await uploadPublicImage(input.logoFile, "coupons");
      // Delete old logo from Blob (no-op if it's a local path).
      if (coupon.logoKey) {
        await deleteBlobByUrl(coupon.logoKey);
      }
      logoKey = result.url;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Error al subir el logo." };
    }
  }

  await prisma.coupon.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description,
      instagramHandle: input.instagramHandle,
      instagramUrl: input.instagramUrl,
      rule: input.rule,
      active: input.active,
      sortOrder: input.sortOrder,
      requiresConsumedSlug: input.requiresConsumedSlug || null,
      hideWhenConsumed: input.hideWhenConsumed,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      fixedCode: input.fixedCode || null,
      websiteUrl: input.websiteUrl || null,
      restrictions: input.restrictions || null,
      logoKey,
    },
  });

  return { success: true };
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  await assertSuperAdmin();

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    return { success: false, error: "Cupón no encontrado." };
  }

  const redemptionCount = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (redemptionCount > 0) {
    return {
      success: false,
      error: `Este cupón tiene ${redemptionCount} canje(s) registrado(s) y no se puede borrar. Desactivalo con "active = false" en su lugar.`,
    };
  }

  await prisma.coupon.delete({ where: { id } });

  if (coupon.logoKey) {
    await deleteBlobByUrl(coupon.logoKey);
  }

  return { success: true };
}

export async function uploadCouponLogo(file: File): Promise<{ success: true; url: string } | { success: false; error: string }> {
  await assertSuperAdmin();
  try {
    const result = await uploadPublicImage(file, "coupons");
    return { success: true, url: result.url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error al subir el logo." };
  }
}
