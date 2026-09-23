"use client";

import { useState } from "react";
import { PERSONAL_BILLING_DEMO_SCENARIOS, projectPersonalBillingDemoScenario, toPersonalBillingViewData } from "@/components/demo/billing/personal-billing-demo";
import type { PersonalBillingDemoScenario } from "@/components/demo/billing/personal-billing-demo";
import { PersonalBillingPageView } from "@/components/personal/PersonalBillingPageView";
import { useDemoPersonal } from "./DemoPersonalProvider";

const scenarioLabels: Record<PersonalBillingDemoScenario, string> = {
  trial: "Trial — 7 días",
  "trial-tomorrow": "Trial — vence mañana",
  "trial-today": "Trial — vence hoy",
  "trial-expired": "Trial — vencido",
  exempt: "Cuenta exenta",
  authorized: "Suscripción activa",
  paused: "Suscripción pausada",
  cancelled: "Suscripción cancelada",
  "no-subscription": "Sin suscripción",
};

/** A display-only local billing simulation; no callback contacts a billing provider. */
export function DemoPersonalBilling() {
  const {
    ready,
    billingAnchor,
    billingScenario,
    billingToken,
    setBillingScenario,
    reset,
    resetEpoch,
  } = useDemoPersonal();
  const [notice, setNotice] = useState<{ epoch: number; text: string } | null>(null);

  if (!ready || billingAnchor === null) {
    return <DemoPersonalBillingMessage message="Preparando la suscripción de demostración…" />;
  }

  const projection = projectPersonalBillingDemoScenario(billingToken, billingScenario, () => new Date(billingAnchor));
  if (projection === null) {
    return <DemoPersonalBillingMessage message="No se pudo cargar la suscripción de demostración. Podés restablecer el ejemplo e intentarlo nuevamente." error onReset={reset} />;
  }
  const viewData = toPersonalBillingViewData(projection);

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <div key={resetEpoch} className="flex flex-col gap-6">
        <p role="status" className="border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm font-body text-yellow-100">
          Demo — sin cobros ni redirecciones
        </p>
        <label className="flex max-w-sm flex-col gap-2 text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Escenario ficticio
          <select
            value={billingScenario}
            onChange={(event) => {
              setNotice(null);
              setBillingScenario(event.target.value as PersonalBillingDemoScenario);
            }}
            className="bg-panel border border-edge px-3 py-2 text-sm font-body normal-case tracking-normal text-white focus:outline-none focus:border-brand-red"
          >
            {PERSONAL_BILLING_DEMO_SCENARIOS.map((scenario) => <option key={scenario} value={scenario}>{scenarioLabels[scenario]}</option>)}
          </select>
        </label>
        {notice?.epoch === resetEpoch && <p role="status" className="border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-body text-emerald-100">{notice.text}</p>}
        <PersonalBillingPageView
          {...viewData}
          onCancelSubscription={async () => {
            setBillingScenario("cancelled");
            return { success: true };
          }}
          onCancelSuccess={() => setNotice({ epoch: resetEpoch, text: "La cancelación fue simulada solo en esta demostración." })}
          onCancelFailure={(error) => setNotice({ epoch: resetEpoch, text: error })}
          onSubscribe={async () => ({ success: true, initPoint: "" })}
          onSubscribeSuccess={(initPoint) => {
            if (initPoint !== "") return;
            setBillingScenario("authorized");
            setNotice({ epoch: resetEpoch, text: "La activación fue simulada localmente; no se realizó ningún cobro ni redirección." });
          }}
        />
        <button type="button" onClick={reset} className="self-start text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white transition-colors">
          Restablecer ejemplo personal
        </button>
      </div>
    </main>
  );
}

function DemoPersonalBillingMessage({ message, error = false, onReset }: { message: string; error?: boolean; onReset?: () => void }) {
  return (
    <main className="flex-1 min-h-[60vh] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl flex flex-col gap-4">
        <p role={error ? "alert" : "status"} className="text-sm font-body text-gray-400">{message}</p>
        {onReset && <button type="button" onClick={onReset} className="self-start text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">Restablecer ejemplo personal</button>}
      </div>
    </main>
  );
}
