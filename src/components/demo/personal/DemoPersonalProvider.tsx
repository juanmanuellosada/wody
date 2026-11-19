"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getPersonalBillingDemoActorToken, type PersonalBillingDemoScenario } from "@/components/demo/billing/personal-billing-demo";
import { createDemoRmCallbackFactory, type DemoRmViewCallbacks } from "@/components/demo/training/demo-rm-adapters";
import { createDemoRmCore } from "@/components/demo/training/demo-rm-core";
import type { DemoRmState } from "@/components/demo/training/demo-rm-types";
import { createPersonalTrainingCallbackFactory, type PersonalTrainingViewCallbacks } from "@/components/demo/training/personal-training-demo-adapters";
import { createPersonalTrainingDemoFixture } from "@/components/demo/training/personal-training-demo-fixtures";
import { getPersonalTrainingActorToken } from "@/components/demo/training/personal-training-demo-state";
import { loadPersonalTrainingDemoState, persistPersonalTrainingDemoState, PERSONAL_TRAINING_DEMO_STORAGE_KEY } from "@/components/demo/training/personal-training-demo-storage";
import type { PersonalTrainingDemoState } from "@/components/demo/training/personal-training-demo-types";

export const PERSONAL_RMS_DEMO_STORAGE_KEY = "wody-personal-rms-demo-v1";
export const PERSONAL_DEMO_OWNER_ID = "personal-student-owner";

const personalRmCore = createDemoRmCore({ kind: "PERSONAL", ownerIds: [PERSONAL_DEMO_OWNER_ID] });
const personalRmToken = personalRmCore.getActorToken(PERSONAL_DEMO_OWNER_ID);

type PersonalDemoStorage = Pick<Storage, "getItem" | "setItem">;

type DemoPersonalContextValue = {
  ready: boolean;
  warning: string | null;
  trainingState: PersonalTrainingDemoState;
  rmsState: DemoRmState;
  trainingCallbacks: PersonalTrainingViewCallbacks | null;
  rmsCallbacks: DemoRmViewCallbacks | null;
  rmCore: typeof personalRmCore;
  rmToken: NonNullable<typeof personalRmToken>;
  personalToken: ReturnType<typeof getPersonalTrainingActorToken>;
  billingToken: ReturnType<typeof getPersonalBillingDemoActorToken>;
  billingScenario: PersonalBillingDemoScenario;
  billingAnchor: Date | null;
  setBillingScenario: (scenario: PersonalBillingDemoScenario) => void;
  reset: () => void;
  resetEpoch: number;
};

const DemoPersonalContext = createContext<DemoPersonalContextValue | null>(null);

function createRmFixture(): DemoRmState {
  return personalRmCore.emptyState();
}

function loadPersonalRms(storage: PersonalDemoStorage | null): { state: DemoRmState; warning: string | null } {
  if (!storage) return { state: createRmFixture(), warning: "El almacenamiento local no está disponible; los cambios no se conservarán." };
  try {
    const raw = storage.getItem(PERSONAL_RMS_DEMO_STORAGE_KEY);
    if (raw === null) return { state: createRmFixture(), warning: null };
    if (raw.trim() === "") return { state: createRmFixture(), warning: "El estado guardado de PRs no es válido; se restauró el ejemplo." };
    const parsed: unknown = JSON.parse(raw);
    return personalRmCore.isValidState(parsed)
      ? { state: parsed as DemoRmState, warning: null }
      : { state: createRmFixture(), warning: "El estado guardado de PRs no es válido; se restauró el ejemplo." };
  } catch {
    return { state: createRmFixture(), warning: "No se pudo leer el almacenamiento local; se usó el estado de respaldo." };
  }
}

function persistPersonalRms(storage: PersonalDemoStorage | null, state: DemoRmState): string | null {
  if (!storage) return "El almacenamiento local no está disponible; los cambios no se conservarán.";
  if (!personalRmCore.isValidState(state)) return "No se guardó un estado de PRs no válido.";
  try {
    storage.setItem(PERSONAL_RMS_DEMO_STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}

/** Owns only PERSONAL routine/PR ledgers and non-persistent billing simulation state. */
export function DemoPersonalProvider({ children }: { children: React.ReactNode }) {
  const [trainingState, setTrainingState] = useState<PersonalTrainingDemoState>(() => createPersonalTrainingDemoFixture());
  const [rmsState, setRmsState] = useState<DemoRmState>(() => createRmFixture());
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [billingScenario, setBillingScenario] = useState<PersonalBillingDemoScenario>("trial");
  const [billingAnchor, setBillingAnchor] = useState<Date | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [callbackBundle, setCallbackBundle] = useState<{ training: PersonalTrainingViewCallbacks; rms: DemoRmViewCallbacks } | null>(null);
  const trainingRef = useRef(trainingState);
  const rmsRef = useRef(rmsState);
  const storageRef = useRef<PersonalDemoStorage | null>(null);
  const hydratedRef = useRef(false);
  const callbacksRef = useRef<{ training: PersonalTrainingViewCallbacks; rms: DemoRmViewCallbacks } | null>(null);

  const commitTraining = useCallback((next: PersonalTrainingDemoState) => {
    trainingRef.current = next;
    setTrainingState(next);
    const persistenceWarning = persistPersonalTrainingDemoState(storageRef.current, next);
    if (persistenceWarning) setWarning(persistenceWarning);
  }, []);

  const commitRms = useCallback((next: DemoRmState) => {
    rmsRef.current = next;
    setRmsState(next);
    const persistenceWarning = persistPersonalRms(storageRef.current, next);
    if (persistenceWarning) setWarning(persistenceWarning);
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      if (hydratedRef.current) return;
      hydratedRef.current = true;
      let storage: PersonalDemoStorage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }

      // Both isolated keys are read before callbacks can commit either fallback.
      const restoredTraining = loadPersonalTrainingDemoState(storage);
      const restoredRms = loadPersonalRms(storage);
      storageRef.current = storage;
      trainingRef.current = restoredTraining.state;
      rmsRef.current = restoredRms.state;
      setTrainingState(restoredTraining.state);
      setRmsState(restoredRms.state);
      setWarning(restoredTraining.warning ?? restoredRms.warning);
      setBillingAnchor(new Date());
      const nextCallbacks = {
        training: createPersonalTrainingCallbackFactory({
          getState: () => trainingRef.current,
          commit: commitTraining,
          personalActorToken: getPersonalTrainingActorToken(),
          now: () => new Date(),
        }),
        rms: createDemoRmCallbackFactory({
          core: personalRmCore,
          fixedOwnerId: PERSONAL_DEMO_OWNER_ID,
          fixedOpaqueToken: personalRmToken,
          getState: () => rmsRef.current,
          commit: commitRms,
        }),
      };
      callbacksRef.current = nextCallbacks;
      setCallbackBundle(nextCallbacks);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [commitRms, commitTraining]);

  useEffect(() => () => {
    callbacksRef.current?.training.cancelPending();
    callbacksRef.current?.rms.cancelPending();
  }, []);

  const reset = useCallback(() => {
    callbacksRef.current?.training.cancelPending();
    callbacksRef.current?.rms.cancelPending();
    const nextTraining = createPersonalTrainingDemoFixture();
    const nextRms = createRmFixture();
    trainingRef.current = nextTraining;
    rmsRef.current = nextRms;
    setTrainingState(nextTraining);
    setRmsState(nextRms);
    const trainingWarning = persistPersonalTrainingDemoState(storageRef.current, nextTraining);
    const rmsWarning = persistPersonalRms(storageRef.current, nextRms);
    setWarning(trainingWarning ?? rmsWarning);
    setBillingScenario("trial");
    setBillingAnchor(new Date());
    setResetEpoch((epoch) => epoch + 1);
  }, []);

  const value = useMemo<DemoPersonalContextValue>(() => ({
    ready,
    warning,
    trainingState,
    rmsState,
    trainingCallbacks: ready ? callbackBundle?.training ?? null : null,
    rmsCallbacks: ready ? callbackBundle?.rms ?? null : null,
    rmCore: personalRmCore,
    rmToken: personalRmToken!,
    personalToken: getPersonalTrainingActorToken(),
    billingToken: getPersonalBillingDemoActorToken(),
    billingScenario,
    billingAnchor,
    setBillingScenario,
    reset,
    resetEpoch,
  }), [billingAnchor, billingScenario, callbackBundle, ready, reset, resetEpoch, rmsState, trainingState, warning]);

  return <DemoPersonalContext.Provider value={value}>{children}</DemoPersonalContext.Provider>;
}

export function useDemoPersonal(): DemoPersonalContextValue {
  const value = useContext(DemoPersonalContext);
  if (!value) throw new Error("useDemoPersonal must be used inside DemoPersonalProvider.");
  return value;
}

export { PERSONAL_TRAINING_DEMO_STORAGE_KEY };
