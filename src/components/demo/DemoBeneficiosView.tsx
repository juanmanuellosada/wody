"use client";

import Image from "next/image";
import { Ticket } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import type { AvailableCoupon } from "@/actions/coupon";
import type { CouponRule } from "@prisma/client";
import { getCouponLogo } from "@/lib/coupon-logos";

const RULE_LABEL: Record<CouponRule, string> = {
  ONCE_PER_USER: "Un solo uso",
  ONCE_GLOBAL: "Único · Primero que llegue",
  UNLIMITED: "Uso libre",
};

function MerchantAvatar({ name, logoKey }: { name: string; logoKey: string | null }) {
  const logo = getCouponLogo(logoKey);
  return (
    <div className="w-16 h-16 flex-shrink-0 bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden">
      {logo ? (
        <Image
          src={logo}
          alt={name}
          width={64}
          height={64}
          className="w-full h-full object-contain p-1"
        />
      ) : (
        <span className="text-xl font-heading font-black uppercase text-brand-red">
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}

function CouponCardDemo({ coupon }: { coupon: AvailableCoupon }) {
  const badgeLabel = RULE_LABEL[coupon.rule];

  return (
    <article className="flex flex-col gap-4 p-6 bg-white/[0.03] border border-white/[0.08] hover:border-brand-red/30 transition-colors duration-300">
      <header className="flex items-start gap-4">
        <MerchantAvatar name={coupon.name} logoKey={coupon.logoKey} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white truncate">
            {coupon.name}
          </h3>
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-brand-red/80 mt-1">
            {badgeLabel}
          </p>
        </div>
      </header>

      <p className="text-xs text-gray-400 font-body leading-relaxed">
        {coupon.description}
      </p>

      {coupon.restrictions && (
        <p className="text-[10px] text-gray-600 font-body italic leading-relaxed -mt-1">
          {coupon.restrictions}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-white/[0.05] pt-4">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 bg-brand-red text-white px-6 py-3 min-h-[44px] font-heading font-bold uppercase tracking-[0.15em] text-xs"
          aria-label="Obtener código (demo)"
          disabled
        >
          <Ticket size={16} aria-hidden="true" />
          <span>Obtener código</span>
        </button>

        <a
          href={coupon.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white border border-edge hover:border-[#3A3A3A] px-6 py-3 min-h-[44px] font-heading font-bold uppercase tracking-[0.15em] text-xs transition-colors"
        >
          <InstagramIcon size={16} />
          <span>@{coupon.instagramHandle}</span>
        </a>
      </div>
    </article>
  );
}

interface Props {
  coupons: AvailableCoupon[];
}

export function DemoBeneficiosView({ coupons }: Props) {
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map((c) => (
          <CouponCardDemo key={c.id} coupon={c} />
        ))}
      </div>
    </div>
  );
}
