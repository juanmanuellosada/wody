import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CouponForm } from "@/components/admin/CouponForm";
import type { CouponRow } from "@/actions/super-admin/coupon";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function EditCouponPage({ params }: Props) {
  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { _count: { select: { redemptions: true } } },
  });

  if (!coupon) notFound();

  const couponRow: CouponRow = {
    id: coupon.id,
    slug: coupon.slug,
    name: coupon.name,
    description: coupon.description,
    instagramHandle: coupon.instagramHandle,
    instagramUrl: coupon.instagramUrl,
    logoKey: coupon.logoKey,
    rule: coupon.rule,
    active: coupon.active,
    sortOrder: coupon.sortOrder,
    requiresConsumedSlug: coupon.requiresConsumedSlug,
    hideWhenConsumed: coupon.hideWhenConsumed,
    expiresAt: coupon.expiresAt,
    fixedCode: coupon.fixedCode,
    websiteUrl: coupon.websiteUrl,
    restrictions: coupon.restrictions,
    createdAt: coupon.createdAt,
    redemptionCount: coupon._count.redemptions,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          <Link href="/admin/coupons" className="hover:underline">Cupones</Link>
          {" / "}Editar
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          {coupon.name}
        </h1>
        <p className="text-xs text-gray-500 font-body mt-1">Slug: {coupon.slug}</p>
      </div>

      <CouponForm coupon={couponRow} />
    </div>
  );
}
