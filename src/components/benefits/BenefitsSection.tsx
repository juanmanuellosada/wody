import { auth } from "@/lib/auth";
import { listAvailableCoupons, listCouponsPreview } from "@/actions/coupon";
import { BenefitsLogin } from "./BenefitsLogin";
import { CouponCard } from "./CouponCard";

export async function BenefitsSection() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);

  const coupons = isLoggedIn
    ? await listAvailableCoupons()
    : await listCouponsPreview();

  return (
    <section className="border-t border-white/5 px-6 py-20 relative">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red text-center mb-3">
          Exclusivo para alumnos
        </p>
        <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-3">
          Beneficios
        </h2>
        <p className="text-sm text-gray-500 font-body text-center max-w-xl mx-auto mb-12">
          Descuentos y regalos de comercios aliados, para alumnos de cualquier
          gym que use WODY.
        </p>

        {!isLoggedIn && (
          <div id="benefits-login" className="mb-12 scroll-mt-24">
            <BenefitsLogin />
          </div>
        )}

        {coupons.length === 0 ? (
          <p className="text-sm text-gray-500 font-body text-center">
            Todavía no hay beneficios disponibles.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map((c) => (
              <CouponCard key={c.id} coupon={c} preview={!isLoggedIn} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
