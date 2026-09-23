"use client";

import type { RevenueView } from "./revenue-view-contracts";

const VIEWS: { id: RevenueView; label: string }[] = [
  { id: "alumnos", label: "Alumnos" },
  { id: "productos", label: "Productos" },
  { id: "mixta", label: "Mixta" },
];

export interface RevenueViewSelectorViewProps {
  view: RevenueView;
  onSelect: (view: RevenueView) => void;
}

/** Controlled revenue-view tabs with no routing dependency. */
export function RevenueViewSelectorView({ view, onSelect }: RevenueViewSelectorViewProps) {
  return (
    <div className="flex gap-2 border-b border-line" role="tablist" aria-label="Vista de recaudación">
      {VIEWS.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          role="tab"
          aria-selected={view === candidate.id}
          onClick={() => onSelect(candidate.id)}
          className={[
            "px-4 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 cursor-pointer border-b-2 -mb-px",
            view === candidate.id ? "text-brand-red border-brand-red" : "text-gray-500 border-transparent hover:text-white",
          ].join(" ")}
        >
          {candidate.label}
        </button>
      ))}
    </div>
  );
}
