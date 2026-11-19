import { Dumbbell } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { formatDateArg } from "@/lib/dates";
import type { FixedRoutineStudentViewRoutine } from "./fixed-routine-view-contracts";

interface FixedRoutineStudentViewProps {
  activeRoutine: FixedRoutineStudentViewRoutine | null;
  renewalWarning: string | null;
}

export function FixedRoutineStudentView({
  activeRoutine,
  renewalWarning,
}: FixedRoutineStudentViewProps) {
  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white mb-5">
        Mi Rutina
      </h1>
      {activeRoutine ? (
        <div className="border border-line bg-panel p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-heading font-black uppercase tracking-[0.08em] text-white">
              {activeRoutine.title}
            </h2>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
              Tu rutina se renueva el {formatDateArg(new Date(activeRoutine.renewAt))}
              {activeRoutine.teacher && (
                <span className="ml-3 text-gray-600">· Profe: {activeRoutine.teacher.name}</span>
              )}
            </p>
          </div>
          {renewalWarning && (
            <p className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-amber-400">
              {renewalWarning}
            </p>
          )}
          <div className="w-12 h-1 bg-brand-red" aria-hidden="true" />
          <MarkdownRenderer content={activeRoutine.content} />
        </div>
      ) : (
        <div className="border border-edge bg-panel p-8 sm:p-12 flex flex-col items-center text-center gap-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-red/10 border border-brand-red/30">
            <Dumbbell size={26} className="text-brand-red" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2 max-w-sm">
            <p className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white">
              Todavía no tenés una rutina cargada
            </p>
            <p className="text-sm text-gray-400 font-body leading-relaxed">
              Avisale a tu profe para que te cargue tu rutina de musculación.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
