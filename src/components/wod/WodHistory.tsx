"use client";

import { useState, useMemo } from "react";
import { WodCard } from "@/components/wod/WodCard";
import { toInputDate, formatDateArg } from "@/lib/dates";
import type { Wod } from "@prisma/client";
import Link from "next/link";

interface WodHistoryProps {
  wods: Pick<Wod, "id" | "title" | "content" | "date">[];
  wodPath: string;
}

export function WodHistory({ wods, wodPath }: WodHistoryProps) {
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
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por título o fecha..."
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-gray-600 text-sm font-heading uppercase tracking-[0.15em] font-bold">
          {searchQuery.trim()
            ? `No se encontraron WODs para "${searchQuery}".`
            : "No hay WODs en el historial."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((wod) => (
            <WodCard
              key={wod.id}
              wod={wod}
              actions={
                <Link
                  href={`${wodPath}?id=${wod.id}`}
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-[#E31414] transition-colors duration-200 cursor-pointer"
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
