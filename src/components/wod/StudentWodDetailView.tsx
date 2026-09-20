import Link from "next/link";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { StudentWodBadge } from "@/components/wod/StudentWodBadge";
import { formatDateArg, getTodayArgentina, toInputDate } from "@/lib/dates";

export type StudentWodDetail = {
  id: string;
  title: string;
  content: string;
  date: Date;
  teacherId: string;
  targetType: "ALL" | "PERSONALIZED" | "GROUP" | "STUDENT";
  targetGroupName?: string | null;
};

type StudentWodDetailViewProps = {
  wod: StudentWodDetail;
  studentId: string;
  backHref?: string;
  onBack?: () => void;
  shareAction?: React.ReactNode;
};

/** Shared production/demo WOD presentation. Data visibility remains owned by its caller. */
export function StudentWodDetailView({ wod, studentId, backHref, onBack, shareAction }: StudentWodDetailViewProps) {
  const dateLabel = formatDateArg(wod.date);
  const isToday = toInputDate(wod.date) === toInputDate(getTodayArgentina());
  const backClassName = "text-xs text-gray-600 hover:text-brand-red uppercase tracking-[0.15em] font-heading font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer";

  return (
    <div className="min-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-6">
        {onBack ? (
          <button type="button" onClick={onBack} className={backClassName}>
            <span aria-hidden="true">&#8592;</span> Volver
          </button>
        ) : backHref ? (
          <Link href={backHref} className={backClassName}>
            <span aria-hidden="true">&#8592;</span> Volver
          </Link>
        ) : null}
        {shareAction}
      </div>

      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            {isToday && (
              <span className="inline-block w-2.5 h-2.5 bg-brand-red flex-shrink-0 animate-pulse" aria-hidden="true" />
            )}
            <h1 className="text-2xl sm:text-4xl font-heading font-black uppercase tracking-[0.1em] text-white">
              {isToday ? wod.title : dateLabel}
            </h1>
          </div>

          {isToday ? (
            <p className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-brand-red mb-2">
              {dateLabel}
            </p>
          ) : (
            <p className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
              {wod.title}
            </p>
          )}

          <div className="w-12 h-1 bg-brand-red mb-6" aria-hidden="true" />

          <div className="mb-8">
            <StudentWodBadge
              targetType={wod.targetType}
              targetGroupName={wod.targetGroupName ?? null}
              isOwn={wod.teacherId === studentId}
            />
          </div>

          <MarkdownRenderer
            content={wod.content}
            className="text-base sm:text-lg [&_h1]:text-2xl [&_h1]:sm:text-3xl [&_h2]:text-xl [&_h2]:sm:text-2xl [&_li]:text-base [&_li]:sm:text-lg [&_p]:text-base [&_p]:sm:text-lg"
          />
        </div>
      </div>
    </div>
  );
}
