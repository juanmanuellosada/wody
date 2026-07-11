"use client";

import { useState } from "react";
import { PaymentHistorySection } from "@/components/PaymentHistorySection";
import { SaleHistorySection } from "@/components/SaleHistorySection";
import { ExpenseHistorySection } from "@/components/ExpenseHistorySection";
import type { PaymentRecord } from "@/lib/payment-stats";
import type { SaleRecord, ExpenseRecord } from "@/lib/finance-stats";

interface Props {
  payments: PaymentRecord[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
}

const TABS = [
  { id: "cuotas", label: "Cuotas" },
  { id: "ventas", label: "Ventas" },
  { id: "gastos", label: "Gastos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Historial de la vista Mixta: por pestañas (cuotas / ventas / gastos). */
export function MixtaHistoryTabs({ payments, sales, expenses }: Props) {
  const [tab, setTab] = useState<TabId>("cuotas");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="tablist" aria-label="Historial de la vista mixta">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              "px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200 cursor-pointer",
              tab === t.id
                ? "border-brand-red text-brand-red bg-brand-red/10"
                : "border-edge text-gray-500 hover:border-[#444444]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "cuotas" && <PaymentHistorySection payments={payments} isAdmin />}
      {tab === "ventas" && <SaleHistorySection sales={sales} />}
      {tab === "gastos" && <ExpenseHistorySection expenses={expenses} />}
    </div>
  );
}
