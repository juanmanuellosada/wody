"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createTrainingCallbackFactory } from "./training-demo-adapters";
import { projectTrainingViews, resetTrainingDemoState, selectTrainingDemoActor } from "./training-demo-state";
import { loadTrainingDemoState, persistTrainingDemoState, resolveTrainingDemoInitialState } from "./training-demo-storage";
import type { TrainingDemoStorage } from "./training-demo-storage";
import type { TrainingDemoState, TrainingResult, TrainingViewCallbacks, TrainingViewProjections } from "./training-demo-types";

type DemoTrainingContextValue = {
  state: TrainingDemoState;
  ready: boolean;
  warning: string | null;
  projections: TrainingViewProjections;
  callbacks: TrainingViewCallbacks;
  selectActor: (actorId: string) => TrainingResult;
  reset: () => void;
};

type DemoTrainingProviderProps = {
  children: React.ReactNode;
  /** Injectable only for focused tests; browser callers use sessionStorage after hydration. */
  storage?: TrainingDemoStorage | null;
  initialState?: TrainingDemoState;
};

const DemoTrainingContext = createContext<DemoTrainingContextValue | null>(null);

function unavailableTrainingCallbacks(): TrainingViewCallbacks {
  const unavailable = { success: false as const, error: "El demo todavía se está restaurando." };
  return {
    onCreateWod: async () => unavailable,
    onUpdateWod: async () => unavailable,
    onDeleteWod: async () => unavailable,
    onCreateFixedRoutine: async () => unavailable,
    onCreateFixedRoutineForGroup: async () => unavailable,
    onCopyWod: async () => unavailable,
    onCreateGroup: async () => unavailable,
    onDeleteGroup: async () => unavailable,
    onRenameGroup: async () => unavailable,
    onAssignStudentToGroup: async () => unavailable,
    onRemoveStudentFromGroup: async () => unavailable,
    rm: {
      createRm: async () => unavailable,
      updateRm: async () => unavailable,
      deleteRm: async () => unavailable,
    },
  };
}

export function DemoTrainingProvider({ children, storage, initialState }: DemoTrainingProviderProps) {
  const [initialFallbackState] = useState<TrainingDemoState>(() => resolveTrainingDemoInitialState(null, initialState).state);
  const [state, setState] = useState<TrainingDemoState>(initialFallbackState);
  const stateRef = useRef<TrainingDemoState>(initialFallbackState);
  const storageRef = useRef<TrainingDemoStorage | null>(null);
  const hydratedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [callbacks, setCallbacks] = useState<TrainingViewCallbacks>(unavailableTrainingCallbacks);

  const commit = useCallback((next: TrainingDemoState) => {
    stateRef.current = next;
    setState(next);
    const persistenceWarning = persistTrainingDemoState(storageRef.current, next);
    if (persistenceWarning) setWarning(persistenceWarning);
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let resolvedStorage: TrainingDemoStorage | null | undefined = storage;
    if (resolvedStorage === undefined && typeof window !== "undefined") {
      try {
        resolvedStorage = window.sessionStorage;
      } catch {
        resolvedStorage = null;
      }
    }
    storageRef.current = resolvedStorage ?? null;
    const restored = loadTrainingDemoState(storageRef.current, initialFallbackState);
    stateRef.current = restored.state;
    setState(restored.state);
    setWarning(restored.warning);
    setCallbacks(() => createTrainingCallbackFactory({ getState: () => stateRef.current, commit }));
    setReady(true);
  }, [storage, commit, initialFallbackState]);

  const selectActor = useCallback((actorId: string): TrainingResult => {
    const selected = selectTrainingDemoActor(stateRef.current, actorId);
    if (selected.result.success) commit(selected.state);
    return selected.result;
  }, [commit]);

  const reset = useCallback(() => {
    commit(resetTrainingDemoState());
  }, [commit]);

  const projections = useMemo(() => projectTrainingViews(state), [state]);
  const value = useMemo(
    () => ({ state, ready, warning, projections, callbacks, selectActor, reset }),
    [state, ready, warning, projections, callbacks, selectActor, reset],
  );

  return <DemoTrainingContext.Provider value={value}>{children}</DemoTrainingContext.Provider>;
}

export function useDemoTraining(): DemoTrainingContextValue {
  const value = useContext(DemoTrainingContext);
  if (!value) throw new Error("useDemoTraining must be used inside DemoTrainingProvider.");
  return value;
}

export type { DemoTrainingContextValue, DemoTrainingProviderProps };
