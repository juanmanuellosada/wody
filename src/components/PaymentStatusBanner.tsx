import { AlertTriangle } from "lucide-react";
import { formatDateArg, getTodayArgentina } from "@/lib/dates";

interface PaymentStatusBannerProps {
  nextPaymentDate: Date;
}

type Status =
  | { kind: "overdue"; days: number }
  | { kind: "due-soon"; days: number }
  | { kind: "ok"; days: number };

function computeStatus(date: Date, today: Date): Status {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((date.getTime() - today.getTime()) / msPerDay);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days <= 7) return { kind: "due-soon", days };
  return { kind: "ok", days };
}

export function PaymentStatusBanner({ nextPaymentDate }: PaymentStatusBannerProps) {
  const today = getTodayArgentina();
  const status = computeStatus(nextPaymentDate, today);
  const formatted = formatDateArg(nextPaymentDate);

  if (status.kind === "ok") {
    return (
      <div className="border border-green-500/20 bg-green-500/5 px-4 py-2 mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" aria-hidden="true" />
          <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-green-400 truncate">
            Cuota al día
          </p>
        </div>
        <p className="text-xs text-gray-500 font-body flex-shrink-0">
          Próximo pago: <span className="text-gray-300">{formatted}</span>
        </p>
      </div>
    );
  }

  if (status.kind === "due-soon") {
    const label =
      status.days === 0
        ? "Vence hoy"
        : status.days === 1
        ? "Vence mañana"
        : `Vence en ${status.days} días`;
    return (
      <div className="border border-yellow-500/40 bg-yellow-500/10 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-yellow-300">
            Cuota por vencer
          </p>
          <p className="text-xs text-gray-400 font-body">
            {label} · {formatted}
          </p>
        </div>
        <span
          className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
          aria-label="Estado de pago: por vencer"
        >
          {label}
        </span>
      </div>
    );
  }

  const overdueLabel =
    status.days === 1 ? "Atrasada 1 día" : `Atrasada ${status.days} días`;
  return (
    <div
      className="border-2 border-brand-red bg-brand-red/10 p-5 mb-6 flex items-center justify-between gap-4 flex-wrap wody-pulse-overdue"
      role="alert"
    >
      <div className="flex items-start gap-3 min-w-0">
        <AlertTriangle
          size={24}
          strokeWidth={2.25}
          className="text-brand-red flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-base font-heading font-black uppercase tracking-[0.1em] text-brand-red">
            Cuota atrasada
          </p>
          <p className="text-xs text-gray-300 font-body">
            Vencida el {formatted}. Regularizá con tu gym para seguir entrenando.
          </p>
        </div>
      </div>
      <span
        className="text-sm font-heading font-black uppercase tracking-[0.15em] px-3 py-1.5 bg-brand-red text-white"
        aria-label="Estado de pago: atrasada"
      >
        {overdueLabel}
      </span>
    </div>
  );
}
