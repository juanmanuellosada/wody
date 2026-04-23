"use client";

import { useState, useMemo } from "react";
import { ClipboardList, SearchX } from "lucide-react";
import { WodCard } from "@/components/wod/WodCard";
import { toInputDate, formatDateArg } from "@/lib/dates";
import type { Wod } from "@prisma/client";
import type { GymTerms } from "@/lib/gym-terms";
import Link from "next/link";

interface WodHistoryProps {
  wods: Pick<Wod, "id" | "title" | "content" | "date">[];
  wodPath: string;
  terms: GymTerms;
}

export function WodHistory({ wods, wodPath, terms }: WodHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return wods;
    const q = searchQuery.toLowerCase();
    return wods.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        formatDateArg(w.date).toLowerCase().includes(q) ||
        toInputDate(w.date).includes(q)
    );
  }, [wods, searchQuery]);

  return (
    <div className="flex flex-col gap-5">
      {wods.length > 0 && (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por título o fecha..."
          aria-label={`Buscar en historial de ${terms.wods}`}
          className="w-full bg-panel border border-edge text-white text-sm font-body px-4 py-3 min-h-[44px] placeholder:text-gray-600 focus:outline-none focus:border-brand-red transition-colors duration-200"
        />
      )}

      {filtered.length === 0 ? (
        <div className="border border-edge p-8 text-center flex flex-col items-center gap-3">
          {searchQuery.trim() ? (
            <>
              <SearchX size={28} className="text-gray-600" aria-hidden="true" />
              <p className="text-gray-500 text-sm font-body">
                Sin resultados para{" "}
                <span className="text-white font-heading font-bold uppercase tracking-[0.1em]">
                  &quot;{searchQuery}&quot;
                </span>
              </p>
            </>
          ) : (
            <>
              <ClipboardList size={28} className="text-gray-600" aria-hidden="true" />
              <p className="text-gray-500 text-sm font-heading font-bold uppercase tracking-[0.15em]">
                Sin {terms.wods} en el historial
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((wod) => (
            <WodCard
              key={wod.id}
              wod={wod}
              actions={
                <Link
                  href={`${wodPath}?id=${wod.id}`}
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red transition-colors duration-200 cursor-pointer"
                >
                  Ver
                </Link>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
