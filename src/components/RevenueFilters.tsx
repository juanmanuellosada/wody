"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import type { PaymentMethod } from "@/lib/payment-stats";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  MERCADO_PAGO: "Mercado Pago",
};

const ALL_METHODS: PaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];

interface Props {
  current: { from: string; to: string; methodIds: PaymentMethod[]; categoryId: string };
  /** Si se pasa, muestra el filtro de categoría (solo la vista Productos lo usa). */
  categories?: { id: string; name: string }[];
}

/** Filtros compartidos por las vistas Productos y Mixta: período + método (+ categoría opcional). */
export function RevenueFilters({ current, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function navigate(overrides: Record<string, string | string[]>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (Array.isArray(v)) {
        const joined = v.filter(Boolean).join(",");
        if (joined) params.set(k, joined);
        else params.delete(k);
      } else if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function toggleMethod(method: PaymentMethod) {
    const next = current.methodIds.includes(method)
      ? current.methodIds.filter((m) => m !== method)
      : [...current.methodIds, method];
    navigate({ statsMethods: next });
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="w-[150px]">
        <DatePicker label="Desde" value={current.from} onChange={(d) => navigate({ statsFrom: d })} />
      </div>
      <div className="w-[150px]">
        <DatePicker label="Hasta" value={current.to} onChange={(d) => navigate({ statsTo: d })} />
      </div>

      <div>
        <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">
          Método
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_METHODS.map((m) => {
            const active = current.methodIds.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className={[
                  "px-3 py-2 text-[11px] font-heading font-bold uppercase tracking-[0.08em] border transition-colors duration-200 cursor-pointer",
                  active
                    ? "border-brand-red text-brand-red bg-brand-red/10"
                    : "border-edge text-gray-400 hover:border-[#444444]",
                ].join(" ")}
              >
                {PAYMENT_METHOD_LABELS[m]}
              </button>
            );
          })}
        </div>
      </div>

      {categories && (
        <div className="w-[180px]">
          <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">
            Categoría
          </label>
          <select
            value={current.categoryId}
            onChange={(e) => navigate({ statsCategoryId: e.target.value })}
            className="w-full bg-elev border border-edge text-white text-sm font-heading font-bold uppercase tracking-[0.08em] px-4 py-3 min-h-[44px] focus:outline-none focus:border-brand-red transition-colors duration-200 cursor-pointer"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
