"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createGymAccessDemoCallbackFactory, type GymAccessDemoCallbacks } from "@/components/demo/access/gym-access-demo-adapters";
import { createGymAccessDemoFixture } from "@/components/demo/access/gym-access-demo-fixtures";
import { loadGymAccessDemoState, persistGymAccessDemoState, type GymAccessDemoStorage } from "@/components/demo/access/gym-access-demo-storage";
import type { GymAccessDemoState } from "@/components/demo/access/gym-access-demo-types";
import { GYM_DEMO_ADMIN_ID, getGymDemoActorToken, getGymDemoProfile } from "@/components/demo/scenarios/gym-demo-directory";
import { useDemoGymFinance } from "./DemoGymFinanceProvider";

export type DemoGymAccessContextValue = {
  ready: boolean;
  warning: string | null;
  state: GymAccessDemoState;
  reset: () => void;
  resetEpoch: number;
  callbacks: GymAccessDemoCallbacks | null;
};

const DemoGymAccessContext = createContext<DemoGymAccessContextValue | null>(null);

/**
 * Owns only the isolated GYM access ledger (wody-gym-access-demo-v1). Never reads, writes, probes,
 * or removes BOX's or Personal's storage keys. GYM finance remains the live roster authority via
 * its own detached state-ref getter, so a just-recorded payment is observable immediately; the
 * profile bridge's blocked/exempt overlay is never read or cached here — it travels as a call-time
 * parameter from the adapter components (DemoGymAccessKiosk / DemoGymAccessHistory) instead.
 */
export function DemoGymAccessProvider({ children }: { children: React.ReactNode }) {
  const finance = useDemoGymFinance();
  const [state, setState] = useState<GymAccessDemoState>(() => createGymAccessDemoFixture());
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [callbacks, setCallbacks] = useState<GymAccessDemoCallbacks | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const stateRef = useRef(state);
  const storageRef = useRef<GymAccessDemoStorage | null>(null);
  const callbacksRef = useRef<GymAccessDemoCallbacks | null>(null);
  const hydratedRef = useRef(false);
  const resetEpochRef = useRef(0);

  const commit = useCallback((next: GymAccessDemoState) => {
    stateRef.current = next;
    setState(next);
    setWarning(persistGymAccessDemoState(storageRef.current, next));
  }, []);

  useEffect(() => {
    if (!finance.ready || hydratedRef.current) return;

    const timer = window.setTimeout(() => {
      if (hydratedRef.current) return;
      hydratedRef.current = true;
      let storage: GymAccessDemoStorage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }

      // Read once before any write. A finance re-render must never rehydrate or reset access.
      const loaded = loadGymAccessDemoState(storage, createGymAccessDemoFixture(finance.today));
      storageRef.current = storage;
      stateRef.current = loaded.state;
      setState(loaded.state);
      setWarning(loaded.warning);

      const actorToken = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
      if (actorToken) {
        const nextCallbacks = createGymAccessDemoCallbackFactory({
          getState: () => stateRef.current,
          getFinanceStudents: finance.getAccessStudents,
          commit,
          actorToken,
          operatorName: getGymDemoProfile(GYM_DEMO_ADMIN_ID)?.name ?? null,
          trustedNow: () => new Date(),
        });
        callbacksRef.current = nextCallbacks;
        setCallbacks(nextCallbacks);
      }
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [commit, finance.getAccessStudents, finance.ready, finance.today]);

  useEffect(() => () => {
    callbacksRef.current?.cancelPending();
  }, []);

  const reset = useCallback(() => {
    callbacksRef.current?.cancelPending();
    const next = createGymAccessDemoFixture(finance.today);
    stateRef.current = next;
    setState(next);
    setWarning(persistGymAccessDemoState(storageRef.current, next));
    resetEpochRef.current += 1;
    setResetEpoch(resetEpochRef.current);
  }, [finance.today]);

  const value = useMemo<DemoGymAccessContextValue>(() => ({
    ready,
    warning,
    state,
    reset,
    resetEpoch,
    callbacks: ready ? callbacks : null,
  }), [callbacks, ready, reset, resetEpoch, state, warning]);

  return <DemoGymAccessContext.Provider value={value}>{children}</DemoGymAccessContext.Provider>;
}

export function useDemoGymAccess(): DemoGymAccessContextValue {
  const context = useContext(DemoGymAccessContext);
  if (!context) throw new Error("useDemoGymAccess must be used within DemoGymAccessProvider.");
  return context;
}
