import type { Metadata } from "next";
import { listAvailableCoupons } from "@/actions/coupon";
import { CouponCard } from "@/components/benefits/CouponCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beneficios",
};

export default async function BeneficiosPage() {
  const coupons = await listAvailableCoupons();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red mb-2">
          Comercios aliados
        </p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white mb-2">
          Beneficios
        </h1>
        <p className="text-sm text-gray-500 font-body max-w-xl">
          Descuentos y regalos para vos. Pedí el código y mostralo al comercio
          desde su Instagram.
        </p>
      </header>

      {coupons.length === 0 ? (
        <p className="text-sm text-gray-500 font-body">
          Todavía no hay beneficios disponibles.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c) => (
            <CouponCard key={c.id} coupon={c} />
          ))}
        </div>
      )}
    </div>
  );
}
