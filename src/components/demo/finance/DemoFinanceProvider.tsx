"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import {
  createFinancePaymentCallbackFactory,
  financeDemoActors,
  type FinancePaymentCallback,
} from "./finance-demo-adapters";
import {
  createCatalogDemoCallbackFactory,
  type CatalogDemoCallbacks,
} from "./catalog-demo-adapters";
import { financeCatalogSaleActors } from "./catalog-sales-contract";
import {
  createSaleDemoCallbackFactory,
  type SaleDemoCallback,
} from "./sale-demo-adapters";
import { createFinanceDemoFixture } from "./finance-demo-state";
import type { SaleDatePolicy } from "@/components/sales/sale-view-contracts";
import {
  loadFinanceDemoState,
  persistFinanceDemoState,
  type FinanceDemoStorage,
} from "./finance-demo-storage";
import type { FeeRole } from "./fees-contract";
import type { FinanceDemoState } from "./finance-demo-types";

type FinanceRoleCallbacks = Record<FeeRole, FinancePaymentCallback>;
type SaleRoleCallbacks = Record<FeeRole, SaleDemoCallback>;

export type DemoFinanceContextValue = {
  ready: boolean;
  warning: string | null;
  state: FinanceDemoState;
  today: string;
  reset: () => void;
  resetEpoch: number;
  callbacks: FinanceRoleCallbacks | null;
  catalogCallbacks: CatalogDemoCallbacks | null;
  saleCallbacks: SaleRoleCallbacks | null;
  saleDatePolicy: SaleDatePolicy;
};

const DemoFinanceContext = createContext<DemoFinanceContextValue | null>(null);

function argentinaToday(): string {
  return toInputDate(getTodayArgentina());
}

/**
 * Owns only fictional, same-tab financial state. Storage is read after mount so
 * static exports never access browser APIs or overwrite a valid saved session.
 */
export function DemoFinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceDemoState>(() => createFinanceDemoFixture());
  const [today, setToday] = useState(state.anchor);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [callbacks, setCallbacks] = useState<FinanceRoleCallbacks | null>(null);
  const [catalogCallbacks, setCatalogCallbacks] = useState<CatalogDemoCallbacks | null>(null);
  const [saleCallbacks, setSaleCallbacks] = useState<SaleRoleCallbacks | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const stateRef = useRef(state);
  const todayRef = useRef(state.anchor);
  const storageRef = useRef<FinanceDemoStorage | null>(null);
  const resetEpochRef = useRef(0);
  const saleDatePolicy = useMemo<SaleDatePolicy>(() => ({ today: argentinaToday }), []);

  const commit = useCallback((next: FinanceDemoState) => {
    stateRef.current = next;
    setState(next);
    const persistenceWarning = persistFinanceDemoState(storageRef.current, next);
    if (persistenceWarning) setWarning(persistenceWarning);
  }, []);

  useEffect(() => {
    const nextToday = argentinaToday();
    todayRef.current = nextToday;
    let storage: FinanceDemoStorage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    const loaded = loadFinanceDemoState(storage, createFinanceDemoFixture(nextToday));
    const timer = window.setTimeout(() => {
      storageRef.current = storage;
      stateRef.current = loaded.state;
      setState(loaded.state);
      setToday(nextToday);
      setWarning(loaded.warning);
      setCallbacks({
        ADMIN: createFinancePaymentCallbackFactory({
          getState: () => stateRef.current,
          commit,
          actor: financeDemoActors.admin,
          today: () => todayRef.current,
        }),
        TEACHER: createFinancePaymentCallbackFactory({
          getState: () => stateRef.current,
          commit,
          actor: financeDemoActors.teacher,
          today: () => todayRef.current,
        }),
      });
      setCatalogCallbacks(createCatalogDemoCallbackFactory({
        getState: () => stateRef.current,
        commit,
        actor: financeCatalogSaleActors.admin,
      }));
      setSaleCallbacks({
        ADMIN: createSaleDemoCallbackFactory({
          getState: () => stateRef.current,
          commit,
          fixedActor: financeCatalogSaleActors.admin,
          datePolicy: saleDatePolicy,
        }),
        TEACHER: createSaleDemoCallbackFactory({
          getState: () => stateRef.current,
          commit,
          fixedActor: financeCatalogSaleActors.teacher,
          datePolicy: saleDatePolicy,
        }),
      });
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commit, saleDatePolicy]);

  const reset = useCallback(() => {
    callbacks?.ADMIN.cancelPendingDuplicate();
    callbacks?.TEACHER.cancelPendingDuplicate();
    saleCallbacks?.ADMIN.cancelPendingSale();
    saleCallbacks?.TEACHER.cancelPendingSale();
    const nextToday = argentinaToday();
    todayRef.current = nextToday;
    setToday(nextToday);
    commit(createFinanceDemoFixture(nextToday));
    resetEpochRef.current += 1;
    setResetEpoch(resetEpochRef.current);
  }, [callbacks, commit, saleCallbacks]);

  const value = useMemo<DemoFinanceContextValue>(() => ({
    ready,
    warning,
    state,
    today,
    reset,
    resetEpoch,
    callbacks: ready ? callbacks : null,
    catalogCallbacks: ready ? catalogCallbacks : null,
    saleCallbacks: ready ? saleCallbacks : null,
    saleDatePolicy,
  }), [callbacks, catalogCallbacks, ready, reset, resetEpoch, saleCallbacks, saleDatePolicy, state, today, warning]);

  return <DemoFinanceContext.Provider value={value}>{children}</DemoFinanceContext.Provider>;
}

export function useDemoFinance(): DemoFinanceContextValue {
  const context = useContext(DemoFinanceContext);
  if (!context) throw new Error("useDemoFinance must be used within DemoFinanceProvider.");
  return context;
}
