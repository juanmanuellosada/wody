"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import { createDemoRmCallbackFactory, type DemoRmViewCallbacks } from "@/components/demo/training/demo-rm-adapters";
import { createDemoRmCore } from "@/components/demo/training/demo-rm-core";
import { createDemoRmStorageAdapter } from "@/components/demo/training/demo-rm-storage";
import type { DemoRmState } from "@/components/demo/training/demo-rm-types";
import { createGymFixedCallbackFactory, type GymFixedViewCallbacks } from "@/components/demo/training/gym-fixed-demo-adapters";
import { resetGymFixedDemoState } from "@/components/demo/training/gym-fixed-demo-state";
import { createGymFixedDemoFixture } from "@/components/demo/training/gym-fixed-demo-fixtures";
import { loadGymFixedDemoState, persistGymFixedDemoState } from "@/components/demo/training/gym-fixed-demo-storage";
import type { GymFixedDemoState } from "@/components/demo/training/gym-fixed-demo-types";
import { createGymTrainingCallbackFactory, type GymTrainingViewCallbacks } from "@/components/demo/training/gym-training-demo-adapters";
import { resetGymTrainingDemoState } from "@/components/demo/training/gym-training-demo-state";
import { createGymTrainingDemoFixture } from "@/components/demo/training/gym-training-demo-fixtures";
import { loadGymTrainingDemoState, persistGymTrainingDemoState } from "@/components/demo/training/gym-training-demo-storage";
import type { GymTrainingDemoState } from "@/components/demo/training/gym-training-demo-types";
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_MUSLIB_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
  getGymDemoActorToken,
  getGymDemoProfile,
  getGymDemoProfiles,
  type GymDemoProfile,
} from "@/components/demo/scenarios/gym-demo-directory";

const GYM_RM_OWNER_IDS = [
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_MUSLIB_STUDENT_ID,
] as const;
const gymRmCore = createDemoRmCore({ kind: "GYM", ownerIds: [...GYM_RM_OWNER_IDS] });
const gymRmStorage = createDemoRmStorageAdapter(gymRmCore);
const staffIds = [GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID] as const;

export type DemoGymScreenRole = "ADMIN" | "TEACHER" | "STUDENT";

type DemoGymContextValue = {
  ready: boolean;
  warning: string | null;
  trainingState: GymTrainingDemoState;
  fixedState: GymFixedDemoState;
  rmsState: DemoRmState;
  selectedActor: GymDemoProfile;
  actorsForRole: (role: DemoGymScreenRole) => GymDemoProfile[];
  selectActor: (role: DemoGymScreenRole, actorId: string) => void;
  trainingCallbacks: GymTrainingViewCallbacks | null;
  fixedCallbacks: GymFixedViewCallbacks | null;
  rmCallbacks: DemoRmViewCallbacks | null;
  rmProjection: ReturnType<typeof gymRmCore.projectRms>;
  resetDatedTraining: () => void;
  resetFixedRoutines: () => void;
  resetRms: () => void;
  /**
   * Adopts a training ledger already persisted by another owner (the GYM profile coordinator, after its
   * single durable write) into this provider's in-memory state only, and only when `base` still matches
   * the live `trainingRef` — the ledger the command actually computed its result from. It never persists:
   * a second write of the same storage key per command would race the coordinator's own write.
   *
   * Returns false, leaving in-memory state untouched, when a newer GYM training mutation landed in
   * `trainingRef` after `base` was captured: the coordinator's write was already durable against a ledger
   * this provider has since moved past, so adopting it here would silently discard that newer mutation.
   * The caller decides how to surface the refusal; it is never retried automatically.
   */
  adoptTrainingState: (base: GymTrainingDemoState, next: GymTrainingDemoState) => boolean;
  /** Reads `trainingRef.current` directly, never a snapshot cached from a previous render. */
  getTrainingState: () => GymTrainingDemoState;
  datedEpoch: number;
  fixedEpoch: number;
  rmEpoch: number;
  today: string | null;
};

const DemoGymContext = createContext<DemoGymContextValue | null>(null);

function defaultActorId(role: DemoGymScreenRole): string {
  if (role === "ADMIN") return GYM_DEMO_ADMIN_ID;
  if (role === "TEACHER") return GYM_DEMO_PRIMARY_TEACHER_ID;
  return GYM_DEMO_PERSONALIZED_STUDENT_ID;
}

function activeFullProfile(actorId: string, role?: DemoGymScreenRole): GymDemoProfile | null {
  const profile = getGymDemoProfile(actorId);
  return profile && profile.deletedAt === null && profile.accountKind === "FULL" && (!role || profile.role === role) ? profile : null;
}

/** Owns exactly the three isolated GYM ledgers; directory identities are never persisted. */
export function DemoGymProvider({ children }: { children: React.ReactNode }) {
  const [trainingState, setTrainingState] = useState<GymTrainingDemoState>(() => createGymTrainingDemoFixture());
  const [fixedState, setFixedState] = useState<GymFixedDemoState>(() => createGymFixedDemoFixture());
  const [rmsState, setRmsState] = useState<DemoRmState>(() => gymRmCore.emptyState());
  const [selectedActorId, setSelectedActorId] = useState(GYM_DEMO_ADMIN_ID);
  const [ready, setReady] = useState(false);
  const [warnings, setWarnings] = useState({ dated: null as string | null, fixed: null as string | null, rms: null as string | null });
  const [datedEpoch, setDatedEpoch] = useState(0);
  const [fixedEpoch, setFixedEpoch] = useState(0);
  const [rmEpoch, setRmEpoch] = useState(0);
  const [today, setToday] = useState<string | null>(null);
  const [publishedFactories, setPublishedFactories] = useState(() => ({
    training: new Map<string, GymTrainingViewCallbacks>(),
    fixed: new Map<string, GymFixedViewCallbacks>(),
    rms: new Map<string, DemoRmViewCallbacks>(),
  }));
  const trainingRef = useRef(trainingState);
  const fixedRef = useRef(fixedState);
  const rmsRef = useRef(rmsState);
  const storageRef = useRef<Pick<Storage, "getItem" | "setItem"> | null>(null);
  const hydratedRef = useRef(false);
  const hydrationGenerationRef = useRef(0);
  const trainingFactories = useRef(new Map<string, GymTrainingViewCallbacks>());
  const fixedFactories = useRef(new Map<string, GymFixedViewCallbacks>());
  const rmFactories = useRef(new Map<string, DemoRmViewCallbacks>());

  const setDomainWarning = useCallback((domain: "dated" | "fixed" | "rms", warning: string | null) => {
    setWarnings((previous) => ({ ...previous, [domain]: warning }));
  }, []);

  const commitTraining = useCallback((next: GymTrainingDemoState) => {
    trainingRef.current = next;
    setTrainingState(next);
    const nextWarning = persistGymTrainingDemoState(storageRef.current, next);
    setDomainWarning("dated", nextWarning);
  }, [setDomainWarning]);
  const commitFixed = useCallback((next: GymFixedDemoState) => {
    fixedRef.current = next;
    setFixedState(next);
    const nextWarning = persistGymFixedDemoState(storageRef.current, next);
    setDomainWarning("fixed", nextWarning);
  }, [setDomainWarning]);
  const commitRms = useCallback((next: DemoRmState) => {
    rmsRef.current = next;
    setRmsState(next);
    const nextWarning = gymRmStorage.persist(storageRef.current, next);
    setDomainWarning("rms", nextWarning);
  }, [setDomainWarning]);
  const adoptTrainingState = useCallback((base: GymTrainingDemoState, next: GymTrainingDemoState): boolean => {
    if (trainingRef.current !== base) return false;
    trainingRef.current = next;
    setTrainingState(next);
    return true;
  }, []);
  const getTrainingState = useCallback(() => trainingRef.current, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    const hydrationGeneration = hydrationGenerationRef.current + 1;
    hydrationGenerationRef.current = hydrationGeneration;
    let storage: Pick<Storage, "getItem" | "setItem"> | null = null;
    try { storage = window.sessionStorage; } catch { storage = null; }
    // Read all owned keys before publishing any callback factory or ready state.
    const restoredTraining = loadGymTrainingDemoState(storage);
    const restoredFixed = loadGymFixedDemoState(storage);
    const restoredRms = gymRmStorage.load(storage);
    const timer = window.setTimeout(() => {
    if (hydrationGenerationRef.current !== hydrationGeneration || hydratedRef.current) return;
    storageRef.current = storage;
    trainingRef.current = restoredTraining.state;
    fixedRef.current = restoredFixed.state;
    rmsRef.current = restoredRms.state;
    setTrainingState(restoredTraining.state);
    setFixedState(restoredFixed.state);
    setRmsState(restoredRms.state);
    setWarnings({ dated: restoredTraining.warning, fixed: restoredFixed.warning, rms: restoredRms.warning });
    const now = () => new Date();
    for (const actorId of staffIds) {
      const token = getGymDemoActorToken(actorId);
      if (!token) continue;
      trainingFactories.current.set(actorId, createGymTrainingCallbackFactory({ getState: () => trainingRef.current, commit: commitTraining, gymActorToken: token, now }));
      fixedFactories.current.set(actorId, createGymFixedCallbackFactory({ getState: () => fixedRef.current, getTrainingState: () => trainingRef.current, commit: commitFixed, fixedActorToken: token, now }));
    }
    for (const ownerId of GYM_RM_OWNER_IDS) {
      const token = gymRmCore.getActorToken(ownerId);
      if (!token) continue;
      rmFactories.current.set(ownerId, createDemoRmCallbackFactory({ core: gymRmCore, fixedOwnerId: ownerId, fixedOpaqueToken: token, getState: () => rmsRef.current, commit: commitRms }));
    }
    setPublishedFactories({
      training: new Map(trainingFactories.current),
      fixed: new Map(fixedFactories.current),
      rms: new Map(rmFactories.current),
    });
    setToday(toInputDate(getTodayArgentina()));
    hydratedRef.current = true;
    setReady(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (!hydratedRef.current && hydrationGenerationRef.current === hydrationGeneration) hydrationGenerationRef.current += 1;
    };
  }, [commitFixed, commitRms, commitTraining]);

  useEffect(() => () => {
    for (const callbacks of trainingFactories.current.values()) callbacks.cancelPending();
    for (const callbacks of fixedFactories.current.values()) callbacks.cancelPending();
    for (const callbacks of rmFactories.current.values()) callbacks.cancelPending();
  }, []);

  const selectActor = useCallback((role: DemoGymScreenRole, actorId: string) => {
    const selected = activeFullProfile(actorId, role);
    if (selected) setSelectedActorId(selected.id);
  }, []);

  const resetDatedTraining = useCallback(() => {
    // Dated callbacks and fixed group batches may both retain the replaced ledger.
    for (const callbacks of trainingFactories.current.values()) callbacks.cancelPending();
    for (const callbacks of fixedFactories.current.values()) callbacks.cancelPending();
    const next = resetGymTrainingDemoState();
    trainingRef.current = next;
    setTrainingState(next);
    setDomainWarning("dated", persistGymTrainingDemoState(storageRef.current, next));
    setDatedEpoch((value) => value + 1);
  }, [setDomainWarning]);
  const resetFixedRoutines = useCallback(() => {
    for (const callbacks of fixedFactories.current.values()) callbacks.cancelPending();
    const next = resetGymFixedDemoState();
    fixedRef.current = next;
    setFixedState(next);
    setDomainWarning("fixed", persistGymFixedDemoState(storageRef.current, next));
    setFixedEpoch((value) => value + 1);
  }, [setDomainWarning]);
  const resetRms = useCallback(() => {
    for (const callbacks of rmFactories.current.values()) callbacks.cancelPending();
    const next = gymRmCore.emptyState();
    rmsRef.current = next;
    setRmsState(next);
    setDomainWarning("rms", gymRmStorage.persist(storageRef.current, next));
    setRmEpoch((value) => value + 1);
  }, [setDomainWarning]);

  const selectedActor = activeFullProfile(selectedActorId) ?? activeFullProfile(GYM_DEMO_ADMIN_ID)!;
  const value = useMemo<DemoGymContextValue>(() => ({
    ready,
    warning: warnings.dated ?? warnings.fixed ?? warnings.rms,
    trainingState,
    fixedState,
    rmsState,
    selectedActor,
    actorsForRole: (role) => getGymDemoProfiles().filter((profile) => profile.deletedAt === null && profile.accountKind === "FULL" && profile.role === role),
    selectActor,
    trainingCallbacks: selectedActor.role === "ADMIN" || selectedActor.role === "TEACHER" ? publishedFactories.training.get(selectedActor.id) ?? null : null,
    fixedCallbacks: selectedActor.role === "ADMIN" || selectedActor.role === "TEACHER" ? publishedFactories.fixed.get(selectedActor.id) ?? null : null,
    rmCallbacks: publishedFactories.rms.get(selectedActor.id) ?? null,
    rmProjection: gymRmCore.projectRms(rmsState, gymRmCore.getActorToken(selectedActor.id)),
    resetDatedTraining,
    resetFixedRoutines,
    resetRms,
    adoptTrainingState,
    getTrainingState,
    datedEpoch,
    fixedEpoch,
    rmEpoch,
    today,
  }), [adoptTrainingState, datedEpoch, fixedEpoch, fixedState, getTrainingState, publishedFactories, ready, rmEpoch, rmsState, resetDatedTraining, resetFixedRoutines, resetRms, selectedActor, selectActor, today, trainingState, warnings]);

  return <DemoGymContext.Provider value={value}>{children}</DemoGymContext.Provider>;
}

export function useDemoGym(): DemoGymContextValue {
  const value = useContext(DemoGymContext);
  if (!value) throw new Error("useDemoGym must be used inside DemoGymProvider.");
  return value;
}

export { defaultActorId };
