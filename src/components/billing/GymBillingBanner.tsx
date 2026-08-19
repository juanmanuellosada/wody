"use client";

import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { formatDateArg, getTodayArgentina } from "@/lib/dates";

interface GymBillingBannerProps {
  subscriptionNextPaymentDate: Date | null;
  /** Gym billed automatically through Mercado Pago. */
  autoDebit?: boolean;
}

export function GymBillingBanner({
  subscriptionNextPaymentDate,
  autoDebit = false,
}: GymBillingBannerProps) {
  if (!subscriptionNextPaymentDate) {
    // No due date configured: neutral state, no block/reminder
    return null;
  }

  const today = getTodayArgentina();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysLeft = Math.round(
    (subscriptionNextPaymentDate.getTime() - today.getTime()) / msPerDay
  );
  const formatted = formatDateArg(subscriptionNextPaymentDate);

  // Automatic debit: the owner has nothing to do, so the banner reports the
  // next charge instead of warning about a due date. It also stays calm past
  // the date, while MP has charged but not yet notified us.
  if (autoDebit) {
    return (
      <div className="w-full px-4 py-2.5 flex items-center justify-between gap-3 bg-green-500/5 border-b border-green-500/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-green-400 truncate">
            Suscripción al día
          </p>
        </div>
        <p className="text-xs text-gray-500 font-body flex-shrink-0">
          Débito automático · <span className="text-gray-300">{formatted}</span>
        </p>
      </div>
    );
  }

  if (daysLeft > 7) {
    // Al día
    return (
      <div className="w-full px-4 py-2.5 flex items-center justify-between gap-3 bg-green-500/5 border-b border-green-500/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-green-400 truncate">
            Suscripción al día
          </p>
        </div>
        <p className="text-xs text-gray-500 font-body flex-shrink-0">
          Próximo pago: <span className="text-gray-300">{formatted}</span>
        </p>
      </div>
    );
  }

  if (daysLeft >= 0) {
    // Por vencer (dentro de 7 días inclusive hoy)
    const label =
      daysLeft === 0
        ? "Vence hoy"
        : daysLeft === 1
        ? "Vence mañana"
        : `Vence en ${daysLeft} días`;
    return (
      <div
        className="w-full px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-yellow-500/10 border-b border-yellow-500/40"
        role="alert"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Clock size={15} className="text-yellow-400 flex-shrink-0" aria-hidden="true" />
          <div className="flex flex-col min-w-0">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-yellow-300">
              Suscripción por vencer
            </p>
            <p className="text-xs text-gray-400 font-body">
              {label} · {formatted}
            </p>
          </div>
        </div>
        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex-shrink-0">
          {label}
        </span>
      </div>
    );
  }

  // Vencido
  const overdueDays = -daysLeft;
  const overdueLabel = overdueDays === 1 ? "Atrasada 1 día" : `Atrasada ${overdueDays} días`;
  return (
    <div
      className="w-full px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-brand-red/10 border-b border-brand-red/40"
      role="alert"
    >
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle size={16} className="text-brand-red flex-shrink-0" aria-hidden="true" />
        <div className="flex flex-col min-w-0">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-brand-red">
            Suscripción vencida
          </p>
          <p className="text-xs text-gray-300 font-body">
            Vencida el {formatted}. Comunicate con el equipo de Wody para renovar.
          </p>
        </div>
      </div>
      <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1.5 bg-brand-red text-white flex-shrink-0">
        {overdueLabel}
      </span>
    </div>
  );
}
