"use client";

import { useMemo } from "react";
import { RmsView } from "@/components/RmsView";
import { gymTerms } from "@/lib/gym-terms";
import { useDemoPersonal } from "./DemoPersonalProvider";

const terms = gymTerms("PERSONAL");

/** PERSONAL PR history is an own-only projection from the trusted isolated RM core. */
export function DemoPersonalRms() {
  const { ready, warning, rmsState, rmsCallbacks, rmCore, rmToken, reset, resetEpoch } = useDemoPersonal();
  const projection = useMemo(() => rmCore.projectRms(rmsState, rmToken), [rmCore, rmToken, rmsState]);

  if (!ready || !rmsCallbacks) {
    return <DemoPersonalRmsMessage message="Preparando tus PRs de demostración…" />;
  }

  if (!projection.success) {
    return <DemoPersonalRmsMessage message={`No se pudieron cargar tus PRs de demostración: ${projection.error}`} error onReset={reset} />;
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <div key={resetEpoch} className="flex flex-col gap-8">
        {warning && <p role="status" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{warning}</p>}
        <RmsView
          rms={projection.rms}
          athleteName="Usuario personal"
          gymName="Wody Personal"
          gymSlug="personal"
          terms={terms}
          onCreateRm={rmsCallbacks.onCreateRm}
          onUpdateRm={rmsCallbacks.onUpdateRm}
          onDeleteRm={rmsCallbacks.onDeleteRm}
        />
        <button type="button" onClick={reset} className="self-start text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white transition-colors">
          Restablecer ejemplo personal
        </button>
      </div>
    </main>
  );
}

function DemoPersonalRmsMessage({ message, error = false, onReset }: { message: string; error?: boolean; onReset?: () => void }) {
  return (
    <main className="flex-1 min-h-[60vh] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl flex flex-col gap-4">
        <p role={error ? "alert" : "status"} className="text-sm font-body text-gray-400">{message}</p>
        {onReset && <button type="button" onClick={onReset} className="self-start text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">Restablecer ejemplo personal</button>}
      </div>
    </main>
  );
}
