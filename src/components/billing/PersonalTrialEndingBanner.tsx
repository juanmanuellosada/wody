"use client";

import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

type Props = {
  daysLeft: number;
};

export function PersonalTrialEndingBanner({ daysLeft }: Props) {
  const expired = daysLeft <= 0;

  const text =
    daysLeft > 1
      ? `Tu trial de Wody Personal termina en ${daysLeft} días`
      : daysLeft === 1
      ? "Tu trial de Wody Personal termina mañana"
      : daysLeft === 0
      ? "Tu trial de Wody Personal termina hoy"
      : "Tu trial de Wody Personal terminó";

  return (
    <div
      className={[
        "w-full px-4 py-3 flex items-center justify-between gap-3 flex-wrap",
        expired
          ? "bg-brand-red/15 border-b border-brand-red/40"
          : "bg-yellow-500/10 border-b border-yellow-500/40",
      ].join(" ")}
      role="alert"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {expired ? (
          <AlertTriangle
            size={16}
            className="text-brand-red flex-shrink-0"
            aria-hidden="true"
          />
        ) : (
          <Clock
            size={16}
            className="text-yellow-400 flex-shrink-0"
            aria-hidden="true"
          />
        )}
        <p
          className={[
            "text-xs font-heading font-bold uppercase tracking-[0.15em]",
            expired ? "text-brand-red" : "text-yellow-300",
          ].join(" ")}
        >
          {text}
        </p>
      </div>
      <Link
        href="/personal/perfil/suscripcion"
        className={[
          "text-xs font-heading font-bold uppercase tracking-[0.15em] px-3 py-1.5 border flex-shrink-0 transition-colors duration-200",
          expired
            ? "border-brand-red text-brand-red hover:bg-brand-red hover:text-white"
            : "border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/15",
        ].join(" ")}
      >
        Configurar tarjeta
      </Link>
    </div>
  );
}
