"use client";

import { useMemo } from "react";
import { WodManagerView } from "@/components/wod/WodManagerView";
import type { WodResult, WodTarget } from "@/actions/wod";
import type { PersonalTrainingWodTarget } from "@/components/demo/training/personal-training-demo-types";
import { gymTerms } from "@/lib/gym-terms";
import { projectPersonalTrainingWods } from "@/components/demo/training/personal-training-demo-state";
import { useDemoPersonal } from "./DemoPersonalProvider";

const terms = gymTerms("PERSONAL");
const PERSONAL_OWNER_ID = "personal-student-owner";
const lockedTarget: PersonalTrainingWodTarget = { type: "STUDENT", studentId: PERSONAL_OWNER_ID };
const unsupportedFixedRoutine = async () => ({ success: false as const, error: "Las rutinas fijas no están disponibles en Wody Personal." });
const unsupportedFixedRoutineGroup = async () => ({ success: false as const, count: 0, error: "Las rutinas fijas no están disponibles en Wody Personal." });

/** Explicitly converts only the one WodManager target that PERSONAL can author. */
export function personalSelfTarget(target: WodTarget | undefined): PersonalTrainingWodTarget | null {
  if (target?.type !== "STUDENT" || target.studentId !== PERSONAL_OWNER_ID) return null;
  return { type: "STUDENT", studentId: PERSONAL_OWNER_ID };
}

function invalidRoutineTarget(): WodResult {
  return { success: false, error: "La rutina no es válida." };
}

/** PERSONAL's self-service routine page reuses the production presentation with a locked own target. */
export function DemoPersonalTrainingRoute() {
  const { ready, warning, trainingState, trainingCallbacks, personalToken, reset, resetEpoch } = useDemoPersonal();
  const projection = useMemo(
    () => projectPersonalTrainingWods(trainingState, personalToken),
    [personalToken, trainingState],
  );

  if (!ready || !trainingCallbacks) {
    return <DemoPersonalLoading message="Preparando tus rutinas de demostración…" />;
  }

  if (projection === null) {
    return <DemoPersonalLoading message="No se pudieron cargar tus rutinas de demostración. Podés restablecer el ejemplo e intentarlo nuevamente." error onReset={reset} />;
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <div key={resetEpoch} className="flex flex-col gap-8">
        {warning && <p role="status" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{warning}</p>}
        <div className="border border-line bg-panel p-6 sm:p-8">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">Mis rutinas</p>
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">Hola</h1>
          <p className="text-sm text-gray-500 font-body mt-2 leading-relaxed">
            Acá podés crear y editar {terms.wods} solo para vos. Los que cargues quedan asignados a tu usuario.
          </p>
        </div>
        <WodManagerView
          wods={projection}
          groups={[]}
          students={[]}
          terms={terms}
          lockedTarget={lockedTarget}
          onCreateWod={(date, title, content, target) => {
            const ownTarget = personalSelfTarget(target);
            return ownTarget
              ? trainingCallbacks.onCreateWod(date, title, content, ownTarget)
              : Promise.resolve(invalidRoutineTarget());
          }}
          onUpdateWod={(wodId, title, content, date, target) => {
            const ownTarget = personalSelfTarget(target);
            return ownTarget
              ? trainingCallbacks.onUpdateWod(wodId, title, content, date, ownTarget)
              : Promise.resolve(invalidRoutineTarget());
          }}
          onDeleteWod={trainingCallbacks.onDeleteWod}
          onCopyWod={(sourceWodId, targetDate, target) => {
            if (target === undefined) return trainingCallbacks.onCopyWod(sourceWodId, targetDate);
            const ownTarget = personalSelfTarget(target);
            return ownTarget
              ? trainingCallbacks.onCopyWod(sourceWodId, targetDate, ownTarget)
              : Promise.resolve(invalidRoutineTarget());
          }}
          onCreateFixedRoutine={unsupportedFixedRoutine}
          onCreateFixedRoutineForGroup={unsupportedFixedRoutineGroup}
        />
        <button type="button" onClick={reset} className="self-start text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white transition-colors">
          Restablecer ejemplo personal
        </button>
      </div>
    </main>
  );
}

function DemoPersonalLoading({ message, error = false, onReset }: { message: string; error?: boolean; onReset?: () => void }) {
  return (
    <main className="flex-1 min-h-[60vh] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl flex flex-col gap-4">
        <p role={error ? "alert" : "status"} className="text-sm font-body text-gray-400">{message}</p>
        {onReset && <button type="button" onClick={onReset} className="self-start text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">Restablecer ejemplo personal</button>}
      </div>
    </main>
  );
}
