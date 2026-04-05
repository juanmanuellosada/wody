import { WodCard } from "@/components/wod/WodCard";
import type { Wod } from "@prisma/client";

interface WodListProps {
  wods: Pick<Wod, "id" | "content" | "date">[];
  renderActions?: (wod: Pick<Wod, "id" | "content" | "date">) => React.ReactNode;
  emptyMessage?: string;
}

export function WodList({
  wods,
  renderActions,
  emptyMessage = "No hay WODs en el historial.",
}: WodListProps) {
  if (wods.length === 0) {
    return (
      <p className="text-gray-600 text-sm font-heading uppercase tracking-[0.15em] font-bold">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {wods.map((wod) => (
        <WodCard
          key={wod.id}
          wod={wod}
          actions={renderActions ? renderActions(wod) : undefined}
        />
      ))}
    </div>
  );
}
