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
import type { FinanceStudent, GymFinanceDemoState } from "@/components/demo/finance/finance-demo-types";
import type { SaleDatePolicy } from "@/components/sales/sale-view-contracts";
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  getGymDemoActorToken,
} from "@/components/demo/scenarios/gym-demo-directory";

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
  /** A detached, current roster bridge for the isolated GYM access-demo provider (mirrors BOX's DemoFinanceProvider). */
  getAccessStudents: () => readonly FinanceStudent[];
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

  /**
   * Intentionally a synchronous state-ref bridge, not a cached copy of any foreign state: access
   * commands can observe a just-committed payment before React renders the next tree. It exposes
   * detached students only, never finance commands or persistence.
   */
  const getAccessStudents = useCallback((): readonly FinanceStudent[] => (
    stateRef.current.students.map((student) => ({
      ...student,
      assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })),
    }))
  ), []);

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
  }, [commit, saleDatePolicy]);

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
    getAccessStudents,
  }), [getAccessStudents, publishedFactories, ready, reset, resetEpoch, saleDatePolicy, state, today, warning]);

  return <DemoGymFinanceContext.Provider value={value}>{children}</DemoGymFinanceContext.Provider>;
}

export function useDemoGymFinance(): DemoGymFinanceContextValue {
  const value = useContext(DemoGymFinanceContext);
  if (!value) throw new Error("useDemoGymFinance must be used inside DemoGymFinanceProvider.");
  return value;
}
