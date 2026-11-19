"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { getGymDemoActorToken } from "@/components/demo/scenarios/gym-demo-directory";
import { defaultActorId, useDemoGym, type DemoGymScreenRole } from "./DemoGymProvider";
import { useDemoGymFinance } from "./DemoGymFinanceProvider";
import { DemoGymFeesAdapter } from "./DemoGymFeesAdapter";
import { DemoGymCashAdapter } from "./DemoGymCashAdapter";
import { DemoGymProductsAdapter } from "./DemoGymProductsAdapter";

export type DemoGymFinanceScreen = "fees" | "cash" | "products";
type Props = { routeKey: string; routeRole: Exclude<DemoGymScreenRole, "STUDENT">; routeActorId: string; screen: DemoGymFinanceScreen };

/** Financial route shell shares the GYM's transient persona; the ledger never owns identity. */
export function SharedDemoGymFinanceRoute({ routeKey, routeRole, routeActorId, screen }: Props) {
  const gym = useDemoGym();
  const finance = useDemoGymFinance();
  const initialized = useRef(new Set<string>());
  const actor = gym.selectedActor;
  const token = getGymDemoActorToken(actor.id);
  const payment = token ? finance.paymentCallbacks?.get(actor.id) ?? null : null;
  const catalog = token ? finance.catalogCallbacks?.get(actor.id) ?? null : null;
  const sale = token ? finance.saleCallbacks?.get(actor.id) ?? null : null;
  const revenue = token ? finance.revenueCallbacks?.get(actor.id) ?? null : null;

  useEffect(() => {
    if (!gym.ready || initialized.current.has(routeKey)) return;
    initialized.current.add(routeKey);
    // Same-role navigation retains the selected persona; only a valid role crossing selects its canonical default.
    if (gym.selectedActor.role !== routeRole) gym.selectActor(routeRole, routeActorId || defaultActorId(routeRole));
  }, [gym, routeActorId, routeKey, routeRole]);

  const cancelSelected = useCallback(() => {
    payment?.cancelPending();
    catalog?.cancelPending();
    sale?.cancelPending();
    revenue?.cancelPending();
  }, [catalog, payment, revenue, sale]);

  useEffect(() => cancelSelected, [cancelSelected]);

  if (!gym.ready || !finance.ready || actor.role !== routeRole || !token) return <Loading />;
  if (screen === "products" && actor.role !== "ADMIN") return <Failure error="No tenés acceso para administrar productos de demostración." />;

  const key = `${actor.id}:${finance.resetEpoch}`;
  return (
    <>
      <main className="max-w-5xl mx-auto w-full px-4 pt-8 sm:pt-10">
        <PersonaSelector role={routeRole} selectedId={actor.id} onSelect={(actorId) => { cancelSelected(); gym.selectActor(routeRole, actorId); }} />
      </main>
      {screen === "fees" && <DemoGymFeesAdapter key={key} />}
      {screen === "cash" && <Suspense fallback={<Loading />}><DemoGymCashAdapter key={key} /></Suspense>}
      {screen === "products" && <DemoGymProductsAdapter key={key} />}
    </>
  );
}

function PersonaSelector({ role, selectedId, onSelect }: { role: DemoGymScreenRole; selectedId: string; onSelect: (actorId: string) => void }) {
  const { actorsForRole } = useDemoGym();
  return <label className="self-start text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500">Persona de demostración<select value={selectedId} onChange={(event) => onSelect(event.target.value)} className="ml-3 bg-panel border border-edge px-2 py-1 text-white normal-case tracking-normal">{actorsForRole(role).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>;
}

function Loading() { return <main className="flex-1 min-h-[60vh] px-4 py-10 text-white"><p className="mx-auto max-w-5xl text-sm font-body text-gray-400">Preparando las finanzas de demostración…</p></main>; }
function Failure({ error }: { error: string }) { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p role="alert" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{error}</p></main>; }
