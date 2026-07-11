"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type RevenueView = "alumnos" | "productos" | "mixta";

const VIEWS: { id: RevenueView; label: string }[] = [
  { id: "alumnos", label: "Alumnos" },
  { id: "productos", label: "Productos" },
  { id: "mixta", label: "Mixta" },
];

interface Props {
  view: RevenueView;
}

export function RevenueViewSelector({ view }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleSelect(next: RevenueView) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "alumnos") {
      params.delete("revenueView");
    } else {
      params.set("revenueView", next);
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className="flex gap-2 border-b border-line" role="tablist" aria-label="Vista de recaudación">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          onClick={() => handleSelect(v.id)}
          className={[
            "px-4 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 cursor-pointer border-b-2 -mb-px",
            view === v.id ? "text-brand-red border-brand-red" : "text-gray-500 border-transparent hover:text-white",
          ].join(" ")}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
