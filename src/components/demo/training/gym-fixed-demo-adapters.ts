// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createGymFixedRoutine, createGymFixedRoutineForGroup, deleteGymFixedRoutine, getGymFixedDemoGroupEligibility, isValidGymFixedDemoState, preflightGymFixedRoutineGroup, renewGymFixedRoutine, updateGymFixedRoutine } from "./gym-fixed-demo-state.ts";
import type {
  GymFixedDemoGroupResult,
  GymFixedDemoResult,
  GymFixedDemoState,
} from "./gym-fixed-demo-types";
import type { GymTrainingDemoState } from "./gym-training-demo-types";

export type GymFixedCallbackFactoryOptions = {
  getState: () => GymFixedDemoState;
  /** Required fresh dated GYM group ledger for each queued group batch. */
  getTrainingState: () => GymTrainingDemoState;
  commit: (state: GymFixedDemoState) => void;
  /** The opaque reference returned by getGymFixedDemoActorToken, never a UI actor copy. */
  fixedActorToken: unknown;
  now?: () => Date;
  nextId?: (state: GymFixedDemoState) => string;
};

export type GymFixedViewCallbacks = {
  onCreateFixedRoutine: (studentId: string, title: string, content: string, renewAt?: string) => Promise<GymFixedDemoResult>;
  onCreateFixedRoutineForGroup: (groupId: string, title: string, content: string, renewAt?: string) => Promise<GymFixedDemoGroupResult>;
  onUpdateFixedRoutine: (routineId: string, title: string, content: string, renewAt: string) => Promise<GymFixedDemoResult>;
  onUpdateFixedRoutineRenewAt: (routineId: string, renewAt: Date) => Promise<GymFixedDemoResult>;
  onDeleteFixedRoutine: (routineId: string) => Promise<GymFixedDemoResult>;
  /** Invalidates queued work during a future provider reset without mutating state itself. */
  cancelPending: () => void;
};

type PendingOperation = {
  key: string;
  generation: number;
  promise: Promise<unknown>;
};

const MAX_ID_ATTEMPTS = 64;
const PROBE_DATE = new Date("2000-01-01T00:00:00.000Z");

function isAllowedActor(token: unknown): boolean {
  const actor = resolveGymDemoActor(token);
  return !!actor && (actor.role === "ADMIN" || actor.role === "TEACHER");
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resultFailure(error: string): GymFixedDemoResult {
  return { success: false, error };
}

function groupFailure(error: string): GymFixedDemoGroupResult {
  return { success: false, error };
}

function invalidRoutineInput(): GymFixedDemoResult {
  return resultFailure("La rutina no es válida.");
}

function invalidGroupInput(): GymFixedDemoGroupResult {
  return groupFailure("La rutina de grupo no es válida.");
}

function pendingFailure<R extends GymFixedDemoResult | GymFixedDemoGroupResult>(): R {
  return { success: false, error: "Hay otra operación de rutinas en curso." } as R;
}

function cancelledFailure<R extends GymFixedDemoResult | GymFixedDemoGroupResult>(): R {
  return { success: false, error: "La operación de rutinas fue cancelada." } as R;
}

function keyPart(value: string | undefined): string {
  return value === undefined ? "-" : `${value.length}:${value}`;
}

function invocationKey(operation: string, values: Array<string | undefined>): string {
  return `${operation}|${values.map(keyPart).join("|")}`;
}

function readRenewDate(value: unknown): { success: true; renewAt: string } | { success: false; error: string } {
  try {
    if (!(value instanceof Date)) return { success: false, error: "Fecha de renovación inválida." };
    const time = Date.prototype.getTime.call(value);
    if (!Number.isFinite(time)) return { success: false, error: "Fecha de renovación inválida." };
    return { success: true, renewAt: new Date(time).toISOString().slice(0, 10) };
  } catch {
    return { success: false, error: "Fecha de renovación inválida." };
  }
}

function defaultId(state: GymFixedDemoState, reserved: ReadonlySet<string>): string {
  const existing = new Set(state.fixedRoutines.map((routine) => routine.id));
  let suffix = 1;
  while (existing.has(`gym-fixed-local-${suffix}`) || reserved.has(`gym-fixed-local-${suffix}`)) suffix += 1;
  return `gym-fixed-local-${suffix}`;
}

/**
 * Action-compatible callbacks for the extracted WodManagerView and
 * FixedRoutineManager signatures. They remain local-only and import no server
 * action at runtime.
 */
export function createGymFixedCallbackFactory(options: GymFixedCallbackFactoryOptions): GymFixedViewCallbacks {
  const now = options.now ?? (() => new Date());
  const customNextId = options.nextId;
  const actorToken = options.fixedActorToken;
  const reservedIds = new Set<string>();
  let generation = 0;
  let pending: PendingOperation | null = null;

  function authorized(): boolean {
    return isAllowedActor(actorToken);
  }

  function allocateIds(state: GymFixedDemoState, count: number): string[] | null {
    const existing = new Set(state.fixedRoutines.map((routine) => routine.id));
    const allocated: string[] = [];
    while (allocated.length < count) {
      let allocatedId: string | null = null;
      for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
        const candidate = customNextId ? customNextId(state) : defaultId(state, reservedIds);
        if (isId(candidate) && !existing.has(candidate) && !reservedIds.has(candidate)) {
          allocatedId = candidate;
          break;
        }
      }
      if (!allocatedId) return null;
      reservedIds.add(allocatedId);
      allocated.push(allocatedId);
    }
    return allocated;
  }

  function commitResult(
    transition: { state: GymFixedDemoState; result: GymFixedDemoResult },
  ): GymFixedDemoResult {
    if (transition.result.success) options.commit(transition.state);
    return transition.result;
  }

  function commitGroupResult(
    transition: { state: GymFixedDemoState; result: GymFixedDemoGroupResult },
  ): GymFixedDemoGroupResult {
    if (transition.result.success) options.commit(transition.state);
    return transition.result;
  }

  function invoke<R extends GymFixedDemoResult | GymFixedDemoGroupResult>(key: string, execute: () => R): Promise<R> {
    if (pending) {
      return pending.key === key && pending.generation === generation
        ? pending.promise as Promise<R>
        : Promise.resolve(pendingFailure<R>());
    }
    const operationGeneration = generation;
    const entry = {} as PendingOperation;
    const promise = Promise.resolve().then(() => {
      if (operationGeneration !== generation) return cancelledFailure<R>();
      return execute();
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

  function currentValidState(): GymFixedDemoState | null {
    const state = options.getState();
    return isValidGymFixedDemoState(state) ? state : null;
  }

  function clockAfterSuccessfulProbe(): unknown {
    // Deliberately do not catch authorized clock failures: callers need them.
    return now();
  }

  return {
    onCreateFixedRoutine(studentId, title, content, renewAt) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      if (!isId(studentId) || typeof title !== "string" || typeof content !== "string" || (renewAt !== undefined && typeof renewAt !== "string")) {
        return Promise.resolve(invalidRoutineInput());
      }
      const key = invocationKey("create", [studentId, title, content, renewAt]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("El estado de rutinas no es válido.");
        const ids = allocateIds(state, 1);
        if (!ids) return resultFailure("No se pudo generar un identificador de rutina único.");
        const command = { id: ids[0]!, studentId, title, content, ...(renewAt === undefined ? {} : { renewAt }) };
        const probe = createGymFixedRoutine(state, actorToken, command, () => PROBE_DATE);
        if (!probe.result.success) return probe.result;
        const clockValue = clockAfterSuccessfulProbe();
        return commitResult(createGymFixedRoutine(state, actorToken, command, () => clockValue));
      });
    },

    onCreateFixedRoutineForGroup(groupId, title, content, renewAt) {
      if (!authorized()) return Promise.resolve(groupFailure("No autorizado."));
      if (!isId(groupId) || typeof title !== "string" || typeof content !== "string" || (renewAt !== undefined && typeof renewAt !== "string")) {
        return Promise.resolve(invalidGroupInput());
      }
      const key = invocationKey("group", [groupId, title, content, renewAt]);
      return invoke(key, () => {
        if (!authorized()) return groupFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return groupFailure("El estado de rutinas no es válido.");
        // Capture one fresh context and synchronously resolve, allocate, and
        // consume it before any await/yield. Never reuse a UI eligibility list.
        const trainingState = options.getTrainingState();
        const preflight = preflightGymFixedRoutineGroup(trainingState, actorToken, groupId, title, content);
        if (!preflight.success) return groupFailure(preflight.error);
        const eligibility = getGymFixedDemoGroupEligibility(trainingState, actorToken, groupId);
        if (!eligibility.success) return groupFailure(eligibility.error);
        const ids = allocateIds(state, eligibility.studentIds.length);
        if (!ids) return groupFailure("No se pudo generar un identificador de rutina único.");
        const command = { groupId, ids, title, content, ...(renewAt === undefined ? {} : { renewAt }) };
        const probe = createGymFixedRoutineForGroup(state, trainingState, actorToken, command, () => PROBE_DATE);
        if (!probe.result.success) return probe.result;
        const clockValue = clockAfterSuccessfulProbe();
        return commitGroupResult(createGymFixedRoutineForGroup(state, trainingState, actorToken, command, () => clockValue));
      });
    },

    onUpdateFixedRoutine(routineId, title, content, renewAt) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      if (!isId(routineId) || typeof title !== "string" || typeof content !== "string" || typeof renewAt !== "string") {
        return Promise.resolve(invalidRoutineInput());
      }
      const key = invocationKey("update", [routineId, title, content, renewAt]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("El estado de rutinas no es válido.");
        return commitResult(updateGymFixedRoutine(state, actorToken, { routineId, title, content, renewAt }));
      });
    },

    onUpdateFixedRoutineRenewAt(routineId, renewAt) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      if (!isId(routineId)) return Promise.resolve(invalidRoutineInput());
      const resolvedDate = readRenewDate(renewAt);
      if (!resolvedDate.success) return Promise.resolve(resultFailure(resolvedDate.error));
      const key = invocationKey("renew", [routineId, resolvedDate.renewAt]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("El estado de rutinas no es válido.");
        return commitResult(renewGymFixedRoutine(state, actorToken, { routineId, renewAt: resolvedDate.renewAt }));
      });
    },

    onDeleteFixedRoutine(routineId) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      if (!isId(routineId)) return Promise.resolve(invalidRoutineInput());
      const key = invocationKey("delete", [routineId]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("El estado de rutinas no es válido.");
        const command = { routineId };
        const probe = deleteGymFixedRoutine(state, actorToken, command, () => PROBE_DATE);
        if (!probe.result.success) return probe.result;
        const clockValue = clockAfterSuccessfulProbe();
        return commitResult(deleteGymFixedRoutine(state, actorToken, command, () => clockValue));
      });
    },

    cancelPending() {
      generation += 1;
      pending = null;
    },
  };
}
