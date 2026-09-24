"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
  getGymDemoActorToken,
} from "@/components/demo/scenarios/gym-demo-directory";
import { applyGymDemoProfileCommand } from "./gym-demo-profile-coordinator";
import type { GymDemoProfileCommandOutcome, GymDemoProfileCoordinatorIO } from "./gym-demo-profile-coordinator";
import { projectGymDemoProfiles } from "./gym-demo-profile-core";
import type { GymDemoProfileState, GymDemoProfileStudentType } from "./gym-demo-profile-core";
import { createGymDemoProfileJournalFixture } from "./gym-demo-profile-journal";
import type { GymDemoProfileJournal } from "./gym-demo-profile-journal";
import { loadGymDemoProfileJournal, persistGymDemoProfileJournal } from "./gym-demo-profile-storage";
import type { GymDemoProfileStorage } from "./gym-demo-profile-storage";
import type { GymTrainingDemoState } from "@/components/demo/training/gym-training-demo-types";
import { useDemoGym } from "./DemoGymProvider";

const staffIds = [GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID] as const;

const BUSY_WARNING = "Hay otra operación de perfiles en curso.";
const CANCELLED_WARNING = "La operación de perfiles fue cancelada.";

export type GymDemoProfileCallbackResult = { success: true } | { success: false; error: string };

/** One factory per staff actor; the core rejects any command outside that actor's own authorized scope. */
export type GymDemoProfileActorCallbacks = {
  editStudent: (studentId: string, name: string) => Promise<GymDemoProfileCallbackResult>;
  setBlocked: (studentId: string, blocked: boolean) => Promise<GymDemoProfileCallbackResult>;
  setPaymentExempt: (studentId: string, exempt: boolean, reason: string | null) => Promise<GymDemoProfileCallbackResult>;
  setType: (studentId: string, studentType: GymDemoProfileStudentType) => Promise<GymDemoProfileCallbackResult>;
  setOwnRoutines: (studentId: string, canCreateOwnRoutines: boolean) => Promise<GymDemoProfileCallbackResult>;
  assignTeacher: (studentId: string, teacherId: string) => Promise<GymDemoProfileCallbackResult>;
  unassignTeacher: (studentId: string, teacherId: string) => Promise<GymDemoProfileCallbackResult>;
  /** Lets provider reset/unmount invalidate a queued command before it commits. */
  cancelPending: () => void;
};

type GymDemoProfileCallbackFactoryOptions = {
  actorToken: object;
  getIo: () => GymDemoProfileCoordinatorIO;
  getJournal: () => GymDemoProfileJournal;
  getTrainingState: () => GymTrainingDemoState;
  applyOutcome: (outcome: GymDemoProfileCommandOutcome) => GymDemoProfileCallbackResult;
};

type PendingCommand = { key: string; generation: number; promise: Promise<GymDemoProfileCallbackResult> };

export type DemoGymProfileContextValue = {
  ready: boolean;
  warning: string | null;
  /** A detached projection: safe for a future UI, never a source of actor authority. */
  profileState: GymDemoProfileState;
  reset: () => void;
  resetEpoch: number;
  commandCallbacks: ReadonlyMap<string, GymDemoProfileActorCallbacks> | null;
};

const DemoGymProfileContext = createContext<DemoGymProfileContextValue | null>(null);

/** A frozen null-prototype facade keeps the mutable factory registry private at runtime (same as GYM finance). */
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

function keyPart(value: string): string {
  return `${value.length}:${value}`;
}

/** Length-prefixed parts (as in the RM adapters) so no argument boundary can be spoofed by its neighbor. */
function commandInvocationKey(operation: string, values: readonly string[]): string {
  return `${operation}|${values.map(keyPart).join("|")}`;
}

/** Wraps one authorized actor's seven profile commands behind a single busy/cancel gate, like the RM/finance adapters. */
function createGymDemoProfileCallbackFactory(options: GymDemoProfileCallbackFactoryOptions): GymDemoProfileActorCallbacks {
  let generation = 0;
  let pending: PendingCommand | null = null;

  function invoke(key: string, buildCommand: () => unknown): Promise<GymDemoProfileCallbackResult> {
    if (pending) {
      return pending.key === key && pending.generation === generation
        ? pending.promise
        : Promise.resolve({ success: false, error: BUSY_WARNING });
    }
    const operationGeneration = generation;
    const entry = {} as PendingCommand;
    const promise = Promise.resolve().then(() => {
      if (operationGeneration !== generation) return { success: false, error: CANCELLED_WARNING } as const;
      const outcome = applyGymDemoProfileCommand(options.getIo(), options.getJournal(), options.getTrainingState(), buildCommand());
      return options.applyOutcome(outcome);
    });
    entry.key = key;
    entry.generation = operationGeneration;
    entry.promise = promise;
    pending = entry;
    void promise.then(
      () => { if (pending === entry) pending = null; },
      () => { if (pending === entry) pending = null; },
    );
    return promise;
  }

  const clock = () => new Date().toISOString();

  return {
    editStudent: (studentId, name) => invoke(commandInvocationKey("edit", [studentId, name]), () => ({
      type: "EDIT_STUDENT", actorToken: options.actorToken, input: { studentId, name },
    })),
    setBlocked: (studentId, blocked) => invoke(commandInvocationKey("blocked", [studentId, String(blocked)]), () => ({
      type: "SET_BLOCKED", actorToken: options.actorToken, input: { studentId, blocked }, clock,
    })),
    setPaymentExempt: (studentId, exempt, reason) => invoke(commandInvocationKey("exempt", [studentId, String(exempt), reason ?? ""]), () => ({
      type: "SET_PAYMENT_EXEMPT", actorToken: options.actorToken, input: { studentId, exempt, reason },
    })),
    setType: (studentId, studentType) => invoke(commandInvocationKey("type", [studentId, studentType]), () => ({
      type: "SET_TYPE", actorToken: options.actorToken, input: { studentId, studentType },
    })),
    setOwnRoutines: (studentId, canCreateOwnRoutines) => invoke(commandInvocationKey("own", [studentId, String(canCreateOwnRoutines)]), () => ({
      type: "SET_OWN_ROUTINES", actorToken: options.actorToken, input: { studentId, canCreateOwnRoutines },
    })),
    assignTeacher: (studentId, teacherId) => invoke(commandInvocationKey("assign", [studentId, teacherId]), () => ({
      type: "ASSIGN_TEACHER", actorToken: options.actorToken, input: { teacherId, studentId },
    })),
    unassignTeacher: (studentId, teacherId) => invoke(commandInvocationKey("unassign", [studentId, teacherId]), () => ({
      type: "UNASSIGN_TEACHER", actorToken: options.actorToken, input: { teacherId, studentId },
    })),
    cancelPending() { generation += 1; pending = null; },
  };
}

/**
 * Owns only the profile journal (`wody-gym-profiles-demo-v1`). It never persists the training ledger
 * itself: `applyGymDemoProfileCommand` performs that single durable write via the shared coordinator, and
 * this provider only adopts the returned training state into DemoGymProvider's in-memory state through
 * `adoptTrainingState`. Must be rendered inside DemoGymProvider.
 */
export function DemoGymProfileProvider({ children }: { children: React.ReactNode }) {
  const gym = useDemoGym();
  const adoptTrainingState = gym.adoptTrainingState;
  const [journal, setJournal] = useState<GymDemoProfileJournal>(() => createGymDemoProfileJournalFixture());
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [publishedFactories, setPublishedFactories] = useState<ReadonlyMap<string, GymDemoProfileActorCallbacks> | null>(null);
  const journalRef = useRef(journal);
  const trainingMirrorRef = useRef<GymTrainingDemoState>(gym.trainingState);
  const storageRef = useRef<GymDemoProfileStorage | null>(null);
  const readyRef = useRef(false);
  const aliveRef = useRef(false);
  const hydrationGenerationRef = useRef(0);
  const factories = useRef(new Map<string, GymDemoProfileActorCallbacks>());

  useEffect(() => {
    trainingMirrorRef.current = gym.trainingState;
  }, [gym.trainingState]);

  const applyOutcome = useCallback((outcome: GymDemoProfileCommandOutcome): GymDemoProfileCallbackResult => {
    if (!outcome.success) return { success: false, error: outcome.error };
    journalRef.current = outcome.journal;
    setJournal(outcome.journal);
    setWarning(outcome.warning);
    trainingMirrorRef.current = outcome.trainingState;
    adoptTrainingState(outcome.trainingState);
    return { success: true };
  }, [adoptTrainingState]);

  useEffect(() => {
    const hydrationGeneration = hydrationGenerationRef.current + 1;
    hydrationGenerationRef.current = hydrationGeneration;
    aliveRef.current = true;
    let storage: GymDemoProfileStorage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }

    // Recovery is read-only: it never repairs a corrupt journal or auto-persists a fallback.
    const restored = loadGymDemoProfileJournal(storage);
    const timer = window.setTimeout(() => {
      if (!aliveRef.current || hydrationGenerationRef.current !== hydrationGeneration) return;
      storageRef.current = storage;
      journalRef.current = restored.journal;
      setJournal(restored.journal);
      setWarning(restored.warning);

      for (const actorId of staffIds) {
        if (factories.current.has(actorId)) continue;
        const token = getGymDemoActorToken(actorId);
        if (!token) continue;
        factories.current.set(actorId, createGymDemoProfileCallbackFactory({
          actorToken: token,
          getIo: () => ({ profileStorage: storageRef.current, trainingStorage: storageRef.current }),
          getJournal: () => journalRef.current,
          getTrainingState: () => trainingMirrorRef.current,
          applyOutcome,
        }));
      }

      // All staff factories exist before this state makes any one of them usable.
      readyRef.current = true;
      setPublishedFactories(createPublishedLookup(factories.current));
      setReady(true);
    }, 0);

    const factoriesForCleanup = factories.current;
    return () => {
      window.clearTimeout(timer);
      for (const callbacks of factoriesForCleanup.values()) callbacks.cancelPending();
      aliveRef.current = false;
      readyRef.current = false;
      storageRef.current = null;
      if (hydrationGenerationRef.current === hydrationGeneration) hydrationGenerationRef.current += 1;
    };
  }, [applyOutcome]);

  const reset = useCallback(() => {
    if (!readyRef.current || !aliveRef.current) return;
    for (const callbacks of factories.current.values()) callbacks.cancelPending();
    const next = createGymDemoProfileJournalFixture();
    journalRef.current = next;
    setJournal(next);
    setWarning(persistGymDemoProfileJournal(storageRef.current, next));
    setResetEpoch((epoch) => epoch + 1);
  }, []);

  const parentReady = gym.ready;
  const value = useMemo<DemoGymProfileContextValue>(() => {
    const contextReady = ready && parentReady;
    return {
      ready: contextReady,
      warning,
      profileState: projectGymDemoProfiles(journal.profileState) ?? journal.profileState,
      reset,
      resetEpoch,
      commandCallbacks: contextReady ? publishedFactories : null,
    };
  }, [journal, parentReady, publishedFactories, ready, reset, resetEpoch, warning]);

  return <DemoGymProfileContext.Provider value={value}>{children}</DemoGymProfileContext.Provider>;
}

export function useDemoGymProfile(): DemoGymProfileContextValue {
  const value = useContext(DemoGymProfileContext);
  if (!value) throw new Error("useDemoGymProfile must be used inside DemoGymProfileProvider.");
  return value;
}
