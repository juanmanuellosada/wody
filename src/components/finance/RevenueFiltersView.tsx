"use client";

import { DatePicker } from "@/components/ui/DatePicker";
import type { RevenueFiltersViewProps, RevenuePaymentMethod } from "./revenue-view-contracts";

const PAYMENT_METHOD_LABELS: Record<RevenuePaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  MERCADO_PAGO: "Mercado Pago",
};

const ALL_METHODS: RevenuePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];

/** Controlled presentation for product and mixed revenue filters. */
export function RevenueFiltersView({
  current,
  categories,
  onFromChange,
  onToChange,
  onMethodToggle,
  onCategoryChange,
}: RevenueFiltersViewProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="w-[150px]">
        <DatePicker label="Desde" value={current.from} onChange={onFromChange} />
      </div>
      <div className="w-[150px]">
        <DatePicker label="Hasta" value={current.to} onChange={onToChange} />
      </div>

      <div>
        <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Método</label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_METHODS.map((method) => {
            const active = current.methodIds.includes(method);
            return (
              <button
                key={method}
                type="button"
                onClick={() => onMethodToggle(method)}
                className={[
                  "px-3 py-2 text-[11px] font-heading font-bold uppercase tracking-[0.08em] border transition-colors duration-200 cursor-pointer",
                  active ? "border-brand-red text-brand-red bg-brand-red/10" : "border-edge text-gray-400 hover:border-[#444444]",
                ].join(" ")}
              >
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            );
          })}
        </div>
      </div>

      {categories && (
        <div className="w-[180px]">
          <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Categoría</label>
          <select
            value={current.categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="w-full bg-elev border border-edge text-white text-sm font-heading font-bold uppercase tracking-[0.08em] px-4 py-3 min-h-[44px] focus:outline-none focus:border-brand-red transition-colors duration-200 cursor-pointer"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
