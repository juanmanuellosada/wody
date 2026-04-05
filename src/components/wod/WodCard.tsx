import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { formatDateArg } from "@/lib/dates";
import type { Wod } from "@prisma/client";

interface WodCardProps {
  wod: Pick<Wod, "id" | "content" | "date">;
  actions?: React.ReactNode;
  highlight?: boolean;
}

export function WodCard({ wod, actions, highlight = false }: WodCardProps) {
  const dateLabel = formatDateArg(wod.date);

  return (
    <Card accent={highlight} className={highlight ? "border-[#E31414]" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            {highlight && (
              <span className="inline-block w-2 h-2 bg-[#E31414] flex-shrink-0 animate-pulse" aria-hidden="true" />
            )}
            <CardTitle className={highlight ? "text-[#E31414]" : ""}>
              {highlight ? "HOY — " : ""}{dateLabel}
            </CardTitle>
          </div>
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      </CardHeader>
      <CardBody>
        <MarkdownRenderer content={wod.content} className="text-sm" />
      </CardBody>
    </Card>
  );
}
