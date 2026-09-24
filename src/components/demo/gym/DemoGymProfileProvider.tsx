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
const UNAVAILABLE_WARNING = "El proveedor de perfiles ya no está disponible.";
const STALE_TRAINING_LEDGER_WARNING =
  "El cambio de perfil se guardó, pero el registro de turnos guardado quedó desactualizado: se calculó antes de una actualización de turnos más reciente, así que si recargás la página vas a perder esa actualización más reciente.";

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
  /** Reads DemoGymProvider's live `trainingRef` directly; never a value cached from a previous render. */
  getTrainingState: () => GymTrainingDemoState;
  /** True only while the provider is mounted, hydrated, and holding a storage handle. */
  isUsable: () => boolean;
  applyOutcome: (base: GymTrainingDemoState, outcome: GymDemoProfileCommandOutcome) => GymDemoProfileCallbackResult;
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
    // Refused before touching the coordinator or any state: cleanup unpublishes readiness but not the
    // factories themselves, so a callback a consumer kept past unmount (or a StrictMode effect restart)
    // must not run against null storage or commit an outcome nobody will ever read.
    if (!options.isUsable()) return Promise.resolve({ success: false, error: UNAVAILABLE_WARNING });
    if (pending) {
      return pending.key === key && pending.generation === generation
        ? pending.promise
        : Promise.resolve({ success: false, error: BUSY_WARNING });
    }
    const operationGeneration = generation;
    const entry = {} as PendingCommand;
    const promise = Promise.resolve().then(() => {
      if (operationGeneration !== generation) return { success: false, error: CANCELLED_WARNING } as const;
      // Re-checked here, not just at invoke entry: cleanup can run in the gap between this microtask
      // being scheduled and it actually draining, and it must not be trusted to always fall through
      // the generation check above before this callback touches storage or the coordinator.
      if (!options.isUsable()) return { success: false, error: UNAVAILABLE_WARNING } as const;
      // Captured fresh, in the same synchronous step the coordinator runs in: no render or mirror sync
      // sits between this read and the coordinator call, so it is always DemoGymProvider's live ledger.
      const base = options.getTrainingState();
      const outcome = applyGymDemoProfileCommand(options.getIo(), options.getJournal(), base, buildCommand());
      return options.applyOutcome(base, outcome);
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
  const getTrainingState = gym.getTrainingState;
  const [journal, setJournal] = useState<GymDemoProfileJournal>(() => createGymDemoProfileJournalFixture());
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [resetEpoch, setResetEpoch] = useState(0);
  const [publishedFactories, setPublishedFactories] = useState<ReadonlyMap<string, GymDemoProfileActorCallbacks> | null>(null);
  const journalRef = useRef(journal);
  const storageRef = useRef<GymDemoProfileStorage | null>(null);
  const readyRef = useRef(false);
  const aliveRef = useRef(false);
  const hydrationGenerationRef = useRef(0);
  const factories = useRef(new Map<string, GymDemoProfileActorCallbacks>());

  const isUsable = useCallback(
    () => aliveRef.current && readyRef.current && storageRef.current !== null,
    [],
  );

  const applyOutcome = useCallback((base: GymTrainingDemoState, outcome: GymDemoProfileCommandOutcome): GymDemoProfileCallbackResult => {
    if (!outcome.success) return { success: false, error: outcome.error };
    journalRef.current = outcome.journal;
    setJournal(outcome.journal);
    if (outcome.trainingState === base) {
      // This command produced no training-ledger write: there is nothing to adopt, and if the live ref
      // moved since `base` was captured, that drift belongs to some unrelated mutation, not this
      // command, so it must never be reported as a conflict here.
      setWarning(outcome.warning);
      return { success: true };
    }
    const adopted = adoptTrainingState(base, outcome.trainingState);
    // A refused adoption means DemoGymProvider's live ledger moved past `base` after this command
    // captured it. The journal/profile write above still landed, so the command itself still succeeds.
    // The coordinator already durably persisted `outcome.trainingState` (computed from the now-stale
    // `base`) to the training storage key, so storage and memory have diverged: memory keeps the newer
    // mutation, but a reload would restore the stale-based ledger and silently lose it. The warning must
    // say that, not that the in-memory sheet was untouched.
    setWarning(adopted ? outcome.warning : STALE_TRAINING_LEDGER_WARNING);
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
          getTrainingState,
          isUsable,
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
  }, [applyOutcome, getTrainingState, isUsable]);

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
