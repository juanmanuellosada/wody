"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { financeCatalogSaleActors } from "../finance/catalog-sales-contract";
import { useDemoFinance } from "../finance/DemoFinanceProvider";
import { createAccessDemoCallbackFactory, type AccessDemoCallbacks } from "./access-demo-adapters";
import { createAccessDemoFixture } from "./access-demo-fixtures";
import { loadAccessDemoState, persistAccessDemoState, type AccessDemoStorage } from "./access-demo-storage";
import type { AccessDemoState } from "./access-demo-types";

export type DemoAccessContextValue = {
  ready: boolean;
  warning: string | null;
  state: AccessDemoState;
  reset: () => void;
  resetEpoch: number;
  callbacks: AccessDemoCallbacks | null;
};

const DemoAccessContext = createContext<DemoAccessContextValue | null>(null);

/**
 * Owns the access ledger only. Finance remains the live roster authority via
 * its detached state-ref getter, so payment commits are observable immediately.
 */
export function DemoAccessProvider({ children }: { children: React.ReactNode }) {
  const finance = useDemoFinance();
  const [state, setState] = useState<AccessDemoState>(() => createAccessDemoFixture());
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [callbacks, setCallbacks] = useState<AccessDemoCallbacks | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const stateRef = useRef(state);
  const storageRef = useRef<AccessDemoStorage | null>(null);
  const callbacksRef = useRef<AccessDemoCallbacks | null>(null);
  const hydratedRef = useRef(false);
  const resetEpochRef = useRef(0);

  const commit = useCallback((next: AccessDemoState) => {
    stateRef.current = next;
    setState(next);
    setWarning(persistAccessDemoState(storageRef.current, next));
  }, []);

  useEffect(() => {
    if (!finance.ready || hydratedRef.current) return;

    const timer = window.setTimeout(() => {
      if (hydratedRef.current) return;
      hydratedRef.current = true;
      let storage: AccessDemoStorage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }

      // Read once before any write. A finance re-render must never rehydrate or reset access.
      const loaded = loadAccessDemoState(storage, createAccessDemoFixture(finance.state.anchor));
      storageRef.current = storage;
      stateRef.current = loaded.state;
      setState(loaded.state);
      setWarning(loaded.warning);

      const nextCallbacks = createAccessDemoCallbackFactory({
        getState: () => stateRef.current,
        getStudents: finance.getAccessStudents,
        commit,
        actor: financeCatalogSaleActors.admin,
        trustedNow: () => new Date(),
      });
      callbacksRef.current = nextCallbacks;
      setCallbacks(nextCallbacks);
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [commit, finance.getAccessStudents, finance.ready, finance.state.anchor]);

  useEffect(() => () => {
    callbacksRef.current?.cancelPending();
  }, []);

  const reset = useCallback(() => {
    callbacksRef.current?.cancelPending();
    const next = createAccessDemoFixture(finance.state.anchor);
    stateRef.current = next;
    setState(next);
    setWarning(persistAccessDemoState(storageRef.current, next));
    resetEpochRef.current += 1;
    setResetEpoch(resetEpochRef.current);
  }, [finance.state.anchor]);

  const value = useMemo<DemoAccessContextValue>(() => ({
    ready,
    warning,
    state,
    reset,
    resetEpoch,
    callbacks: ready ? callbacks : null,
  }), [callbacks, ready, reset, resetEpoch, state, warning]);

  return <DemoAccessContext.Provider value={value}>{children}</DemoAccessContext.Provider>;
}

export function useDemoAccess(): DemoAccessContextValue {
  const context = useContext(DemoAccessContext);
  if (!context) throw new Error("useDemoAccess must be used within DemoAccessProvider.");
  return context;
}
