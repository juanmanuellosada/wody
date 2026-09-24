"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import {
  createGymFinancePaymentCallbackFactory,
  type GymFinancePaymentCallback,
} from "@/components/demo/finance/gym-finance-payment-adapters";
import {
  createGymCatalogDemoCallbackFactory,
  type GymCatalogDemoCallbacks,
} from "@/components/demo/finance/gym-catalog-demo-adapters";
import {
  createGymSaleDemoCallbackFactory,
  type GymSaleDemoCallback,
} from "@/components/demo/finance/gym-sale-demo-adapters";
import {
  createGymRevenueDemoCallbackFactory,
  type GymRevenueDemoCallbacks,
} from "@/components/demo/finance/gym-revenue-demo-adapters";
import { createGymFinanceDemoFixture } from "@/components/demo/finance/gym-finance-demo-fixtures";
import {
  loadGymFinanceDemoState,
  persistGymFinanceDemoState,
  type GymFinanceDemoStorage,
} from "@/components/demo/finance/gym-finance-demo-storage";
import type { GymFinanceDemoState } from "@/components/demo/finance/finance-demo-types";
import type { SaleDatePolicy } from "@/components/sales/sale-view-contracts";
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  getGymDemoActorToken,
} from "@/components/demo/scenarios/gym-demo-directory";
import type { GymFinanceTeacherStudentLink } from "@/components/demo/finance/finance-demo-policy";
import { useDemoGymProfile } from "./DemoGymProfileProvider";

const paymentActorIds = [GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID] as const;
const saleActorIds = paymentActorIds;

export type DemoGymFinanceContextValue = {
  ready: boolean;
  warning: string | null;
  state: GymFinanceDemoState;
  today: string;
  reset: () => void;
  resetEpoch: number;
  /** Directory IDs are lookup keys only; authority remains inside factory closures. */
  paymentCallbacks: ReadonlyMap<string, GymFinancePaymentCallback> | null;
  catalogCallbacks: ReadonlyMap<string, GymCatalogDemoCallbacks> | null;
  saleCallbacks: ReadonlyMap<string, GymSaleDemoCallback> | null;
  revenueCallbacks: ReadonlyMap<string, GymRevenueDemoCallbacks> | null;
  saleDatePolicy: SaleDatePolicy;
  expenseDatePolicy: SaleDatePolicy;
};

const DemoGymFinanceContext = createContext<DemoGymFinanceContextValue | null>(null);

function argentinaToday(): string {
  return toInputDate(getTodayArgentina());
}

/** Cancelling first prevents an old queued reducer from committing into a replaced ledger. */
function cancelAllFactories(
  payments: ReadonlyMap<string, GymFinancePaymentCallback>,
  catalogs: ReadonlyMap<string, GymCatalogDemoCallbacks>,
  sales: ReadonlyMap<string, GymSaleDemoCallback>,
  revenues: ReadonlyMap<string, GymRevenueDemoCallbacks>,
) {
  for (const callbacks of payments.values()) callbacks.cancelPending();
  for (const callbacks of catalogs.values()) callbacks.cancelPending();
  for (const callbacks of sales.values()) callbacks.cancelPending();
  for (const callbacks of revenues.values()) callbacks.cancelPending();
}

/** A frozen null-prototype facade keeps mutable factory registries private at runtime. */
function createPublishedLookup<T>(backing: Map<string, T>): ReadonlyMap<string, T> {
  const facade = Object.create(null) as Record<PropertyKey, unknown>;
  const entries = () => Array.from(backing, ([key, value]) => Object.freeze([key, value] as const)).values();
  const keys = () => Array.from(backing.keys()).values();
  const values = () => Array.from(backing.values()).values();
  Object.defineProperties(facade, {
    get: { value: (key: string) => backing.get(key) },
    has: { value: (key: string) => backing.has(key) },
    size: { get: () => backing.size },
    entries: { value: entries },
    keys: { value: keys },
    values: { value: values },
    forEach: {
      value: (callback: (value: T, key: string, map: ReadonlyMap<string, T>) => void, thisArg?: unknown) => {
        backing.forEach((value, key) => callback.call(thisArg, value, key, facade as unknown as ReadonlyMap<string, T>));
      },
    },
    [Symbol.iterator]: { value: entries },
  });
  return Object.freeze(facade) as unknown as ReadonlyMap<string, T>;
}

/**
 * Owns only the unmounted GYM financial ledger. Route personas remain owned by
 * DemoGymProvider; consumers select a canonical directory ID against readonly
 * callback maps and never persist an actor, token, or role selection here.
 */
export function DemoGymFinanceProvider({ children }: { children: React.ReactNode }) {
  const { profileState } = useDemoGymProfile();
  const initialAnchor = argentinaToday();
  const [state, setState] = useState<GymFinanceDemoState>(() => createGymFinanceDemoFixture(initialAnchor));
  const [today, setToday] = useState(initialAnchor);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [publishedFactories, setPublishedFactories] = useState(() => ({
    payments: null as ReadonlyMap<string, GymFinancePaymentCallback> | null,
    catalogs: null as ReadonlyMap<string, GymCatalogDemoCallbacks> | null,
    sales: null as ReadonlyMap<string, GymSaleDemoCallback> | null,
    revenues: null as ReadonlyMap<string, GymRevenueDemoCallbacks> | null,
  }));
  const stateRef = useRef(state);
  const storageRef = useRef<GymFinanceDemoStorage | null>(null);
  const readyRef = useRef(false);
  const aliveRef = useRef(false);
  const hydrationGenerationRef = useRef(0);
  const paymentFactories = useRef(new Map<string, GymFinancePaymentCallback>());
  const catalogFactories = useRef(new Map<string, GymCatalogDemoCallbacks>());
  const saleFactories = useRef(new Map<string, GymSaleDemoCallback>());
  const revenueFactories = useRef(new Map<string, GymRevenueDemoCallbacks>());
  const saleDatePolicy = useMemo<SaleDatePolicy>(() => ({ today: argentinaToday }), []);
  const gymTeacherStudentLinksRef = useRef<readonly GymFinanceTeacherStudentLink[]>(profileState.links);
  const getGymTeacherStudentLinks = useCallback(() => gymTeacherStudentLinksRef.current, []);

  /** Publish the ref before React state so independently queued factories share one current ledger. */
  const commit = useCallback((next: GymFinanceDemoState) => {
    if (!aliveRef.current || !readyRef.current) return;
    stateRef.current = next;
    setState(next);
    const persistenceWarning = persistGymFinanceDemoState(storageRef.current, next);
    setWarning(persistenceWarning);
  }, []);

  useEffect(() => {
    const hydrationGeneration = hydrationGenerationRef.current + 1;
    hydrationGenerationRef.current = hydrationGeneration;
    aliveRef.current = true;
    let storage: GymFinanceDemoStorage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }

    // Recovery is deliberately read-only: it never repairs a corrupt value or auto-persists a fallback.
    const anchor = argentinaToday();
    const restored = loadGymFinanceDemoState(storage, createGymFinanceDemoFixture(anchor).anchor);
    const timer = window.setTimeout(() => {
      if (!aliveRef.current || hydrationGenerationRef.current !== hydrationGeneration) return;
      storageRef.current = storage;
      stateRef.current = restored.state;
      setState(restored.state);
      setToday(anchor);
      setWarning(restored.warning);

      for (const actorId of paymentActorIds) {
        if (paymentFactories.current.has(actorId)) continue;
        const token = getGymDemoActorToken(actorId);
        if (!token) continue;
        paymentFactories.current.set(actorId, createGymFinancePaymentCallbackFactory({
          getState: () => stateRef.current,
          commit,
          gymActorToken: token,
          today: argentinaToday,
          getGymTeacherStudentLinks,
        }));
      }
      if (!catalogFactories.current.has(GYM_DEMO_ADMIN_ID)) {
        const token = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
        if (token) catalogFactories.current.set(GYM_DEMO_ADMIN_ID, createGymCatalogDemoCallbackFactory({ getState: () => stateRef.current, commit, gymActorToken: token }));
      }
      for (const actorId of saleActorIds) {
        if (saleFactories.current.has(actorId)) continue;
        const token = getGymDemoActorToken(actorId);
        if (!token) continue;
        saleFactories.current.set(actorId, createGymSaleDemoCallbackFactory({
          getState: () => stateRef.current,
          commit,
          gymActorToken: token,
          trustedSaleDatePolicy: saleDatePolicy,
        }));
      }
      if (!revenueFactories.current.has(GYM_DEMO_ADMIN_ID)) {
        const token = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
        if (token) revenueFactories.current.set(GYM_DEMO_ADMIN_ID, createGymRevenueDemoCallbackFactory({
          getState: () => stateRef.current,
          commit,
          boundGymActorToken: token,
          trustedExpenseDatePolicy: saleDatePolicy,
        }));
      }

      // All eight factories exist before this state makes any one of them usable.
      readyRef.current = true;
      setPublishedFactories({
        payments: createPublishedLookup(paymentFactories.current),
        catalogs: createPublishedLookup(catalogFactories.current),
        sales: createPublishedLookup(saleFactories.current),
        revenues: createPublishedLookup(revenueFactories.current),
      });
      setReady(true);
    }, 0);

    const factoriesForCleanup = {
      payments: paymentFactories.current,
      catalogs: catalogFactories.current,
      sales: saleFactories.current,
      revenues: revenueFactories.current,
    };
    return () => {
      window.clearTimeout(timer);
      cancelAllFactories(factoriesForCleanup.payments, factoriesForCleanup.catalogs, factoriesForCleanup.sales, factoriesForCleanup.revenues);
      // Invalidate provider access only after every adapter invalidates its queued generation.
      aliveRef.current = false;
      readyRef.current = false;
      storageRef.current = null;
      if (hydrationGenerationRef.current === hydrationGeneration) hydrationGenerationRef.current += 1;
    };
  }, [commit, getGymTeacherStudentLinks, saleDatePolicy]);

  // This provider does not own the profile bridge's writes (DemoGymProfileProvider does), so it
  // cannot expose a live ref updated at the write site the way DemoGymProvider's training ref is;
  // mirroring via an effect is the only lint-clean option available at this ownership boundary.
  //
  // This has a real transient window between the bridge's commit and this effect's flush, and it is
  // NOT symmetric. A REMOVAL is safe: DemoGymFeesAdapter reads profileState.links directly (not
  // through this ref) for the same-render Cuotas scoping, so a student a link change removes from a
  // TEACHER's list also loses their "Pagar" affordance in that same render, before this stale ref
  // could ever be reached. An ADDITION is NOT safe the same way: the newly linked student's row (and
  // its "Pagar" affordance) can render in that same render too, but this ref — and therefore
  // registerFinancePayment's authorization — still holds the OLD link set until this effect flushes.
  // A payment attempted in that window fails closed (denied as unassigned, never wrongly allowed),
  // but it is a real, observable false rejection, not a cosmetic delay.
  //
  // A useLayoutEffect would close this synchronously before paint, but there is no existing
  // precedent for it anywhere in this codebase, and these GYM routes are server-rendered
  // (DemoGymFinanceProvider is a "use client" component, but usePathname resolves during SSR, so
  // this component's first render is not deferred to a client-only mount); React warns when
  // useLayoutEffect runs during SSR, and this effort's verification bar has been zero unexpected
  // console output throughout. The window is currently unreachable regardless: DemoGymFeeRowActions
  // in DemoGymFeesAdapter.tsx exposes no assign/unassign control, so nothing in the mounted UI can
  // call ASSIGN_TEACHER yet, and this candidate does not add one. Revisit this trade-off, including
  // useLayoutEffect, once that control exists and the window becomes reachable.
  useEffect(() => {
    gymTeacherStudentLinksRef.current = profileState.links;
  }, [profileState]);

  const reset = useCallback(() => {
    if (!readyRef.current || !aliveRef.current) return;
    cancelAllFactories(paymentFactories.current, catalogFactories.current, saleFactories.current, revenueFactories.current);
    const anchor = argentinaToday();
    const next = createGymFinanceDemoFixture(anchor);
    stateRef.current = next;
    setState(next);
    setToday(anchor);
    setWarning(persistGymFinanceDemoState(storageRef.current, next));
    setResetEpoch((epoch) => epoch + 1);
  }, []);

  const value = useMemo<DemoGymFinanceContextValue>(() => ({
    ready,
    warning,
    state,
    today,
    reset,
    resetEpoch,
    paymentCallbacks: ready ? publishedFactories.payments : null,
    catalogCallbacks: ready ? publishedFactories.catalogs : null,
    saleCallbacks: ready ? publishedFactories.sales : null,
    revenueCallbacks: ready ? publishedFactories.revenues : null,
    saleDatePolicy,
    expenseDatePolicy: saleDatePolicy,
  }), [publishedFactories, ready, reset, resetEpoch, saleDatePolicy, state, today, warning]);

  return <DemoGymFinanceContext.Provider value={value}>{children}</DemoGymFinanceContext.Provider>;
}

export function useDemoGymFinance(): DemoGymFinanceContextValue {
  const value = useContext(DemoGymFinanceContext);
  if (!value) throw new Error("useDemoGymFinance must be used inside DemoGymFinanceProvider.");
  return value;
}
