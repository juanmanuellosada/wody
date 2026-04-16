"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Check, Copy, Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { generateRedemption, type AvailableCoupon } from "@/actions/coupon";
import { getCouponLogo } from "@/lib/coupon-logos";
import { InstagramIcon } from "@/components/icons/InstagramIcon";

interface CouponCardProps {
  coupon: AvailableCoupon;
}

const RULE_LABEL: Record<AvailableCoupon["rule"], string> = {
  ONCE_PER_USER: "Un solo uso",
  ONCE_GLOBAL: "Único · Primero que llegue",
  UNLIMITED: "Uso libre",
};

export function CouponCard({ coupon }: CouponCardProps) {
  const [code, setCode] = useState<string | null>(coupon.pendingCode);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const logo = getCouponLogo(coupon.logoKey);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateRedemption(coupon.slug);
      if (result.success) {
        setCode(result.code);
      } else {
        setError(result.error);
      }
    });
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const blocked = coupon.blocked && !code;

  return (
    <article
      className={[
        "flex flex-col gap-4 p-6 bg-white/[0.03] border transition-colors duration-300",
        blocked
          ? "border-white/[0.04] opacity-50"
          : "border-white/[0.08] hover:border-brand-red/30",
      ].join(" ")}
    >
      <header className="flex items-start gap-4">
        <div className="w-16 h-16 flex-shrink-0 bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden">
          {logo ? (
            <Image
              src={logo}
              alt={coupon.name}
              width={64}
              height={64}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <span className="text-xl font-heading font-black uppercase text-brand-red">
              {coupon.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white truncate">
            {coupon.name}
          </h3>
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-brand-red/80 mt-1">
            {RULE_LABEL[coupon.rule]}
          </p>
        </div>
      </header>

      <p className="text-xs text-gray-400 font-body leading-relaxed">
        {coupon.description}
      </p>

      {blocked ? (
        <p className="mt-auto text-[11px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600 border-t border-white/[0.05] pt-4">
          {coupon.blockedReason ?? "No disponible"}
        </p>
      ) : code ? (
        <div className="mt-auto flex flex-col gap-3 border-t border-white/[0.05] pt-4">
          <button
            type="button"
            onClick={handleCopy}
            className="group flex items-center justify-between gap-2 bg-black border border-brand-red/40 px-4 py-3 hover:border-brand-red transition-colors cursor-pointer"
            aria-label="Copiar código"
          >
            <span className="font-heading font-black tracking-[0.2em] text-sm text-white">
              {code}
            </span>
            {copied ? (
              <Check size={16} className="text-brand-red" aria-hidden="true" />
            ) : (
              <Copy
                size={16}
                className="text-gray-500 group-hover:text-brand-red transition-colors"
                aria-hidden="true"
              />
            )}
          </button>

          <a
            href={coupon.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-red-dark text-white px-6 py-3 min-h-[44px] font-heading font-bold uppercase tracking-[0.15em] text-xs transition-colors"
          >
            <InstagramIcon size={16} />
            <span>Contactar @{coupon.instagramHandle}</span>
          </a>

          <p className="text-[10px] text-gray-600 font-body text-center leading-relaxed">
            Mostrale este código al comercio. Se valida una sola vez.
          </p>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-2 border-t border-white/[0.05] pt-4">
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={isPending}
            onClick={handleGenerate}
          >
            {isPending ? null : (
              <>
                <Ticket size={16} aria-hidden="true" />
                <span>Obtener código</span>
              </>
            )}
          </Button>
          {error && (
            <p className="text-[10px] font-heading font-bold text-brand-red uppercase tracking-wide text-center">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
