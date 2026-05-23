import { listAllCoupons } from "@/actions/super-admin/coupon";
import { CouponsTable } from "@/components/admin/CouponsTable";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const coupons = await listAllCoupons();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
            Super Admin
          </p>
          <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
            Cupones
          </h1>
        </div>
        <Link
          href="/admin/coupons/new"
          className="px-5 py-2.5 bg-brand-red text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200"
        >
          + Nuevo Cupón
        </Link>
      </div>

      <CouponsTable coupons={coupons} />
    </div>
  );
}
