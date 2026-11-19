"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "cuotas", label: "Cuotas" },
  { id: "ventas", label: "Ventas" },
  { id: "gastos", label: "Gastos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface MixtaHistoryTabsViewProps {
  cuotas: ReactNode;
  ventas: ReactNode;
  gastos: ReactNode;
}

/** Client-side tab presentation; inactive history slots intentionally unmount. */
export function MixtaHistoryTabsView({ cuotas, ventas, gastos }: MixtaHistoryTabsViewProps) {
  const [tab, setTab] = useState<TabId>("cuotas");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="tablist" aria-label="Historial de la vista mixta">
        {TABS.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            role="tab"
            aria-selected={tab === candidate.id}
            onClick={() => setTab(candidate.id)}
            className={[
              "px-3 py-1.5 text-[11px] font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200 cursor-pointer",
              tab === candidate.id ? "border-brand-red text-brand-red bg-brand-red/10" : "border-edge text-gray-500 hover:border-[#444444]",
            ].join(" ")}
          >
            {candidate.label}
          </button>
        ))}
      </div>
      {tab === "cuotas" && cuotas}
      {tab === "ventas" && ventas}
      {tab === "gastos" && gastos}
    </div>
  );
}
