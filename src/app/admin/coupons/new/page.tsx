import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CouponForm } from "@/components/admin/CouponForm";

export default async function NewCouponPage() {
  const agg = await prisma.coupon.aggregate({ _max: { sortOrder: true } });
  const nextSortOrder = (agg._max.sortOrder ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          <Link href="/admin/coupons" className="hover:underline">Cupones</Link>
          {" / "}Nuevo
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Nuevo Cupón
        </h1>
      </div>

      <CouponForm nextSortOrder={nextSortOrder} />
    </div>
  );
}
