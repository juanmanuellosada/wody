"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { subscribeGym } from "@/actions/billing";

export function GymCardFormSection() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubscribe() {
    setError(null);
    startTransition(async () => {
      const result = await subscribeGym();
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.href = result.initPoint;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-start gap-2.5 border border-brand-red/30 bg-brand-red/5 px-4 py-3">
          <AlertTriangle size={14} className="text-brand-red flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-body text-red-400">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubscribe}
        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-red text-white text-sm font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200 w-full sm:w-fit disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Preparando...
          </>
        ) : (
          <>
            <ExternalLink size={16} aria-hidden="true" />
            Suscribirme — $40.000 ARS/mes
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 font-body">
        Serás redirigido a Mercado Pago para autorizar el débito automático. El cobro se realiza recién al finalizar el período de prueba.
      </p>
    </div>
  );
}
