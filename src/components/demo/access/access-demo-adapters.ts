// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createManualAccess, decidePendingAccess, isAccessInstant, isAuthorizedAccessActor, lookupAccessStudent, projectAccessDailyFeed, projectAccessHistory } from "./access-demo-state.ts";
import type {
  AccessCommandResult,
  AccessDecision,
  AccessDecisionResult,
  AccessDemoState,
  AccessDailyFeed,
  AccessHistoryRow,
  AccessLookupResult,
  AccessStudent,
} from "./access-demo-types";

export type AccessTrustedClock = () => Date | number | string;
export type AccessDemoCallbackFactoryOptions = {
  getState: () => AccessDemoState;
  getStudents: () => readonly AccessStudent[];
  commit: (state: AccessDemoState) => void;
  actor: unknown;
  trustedNow?: AccessTrustedClock;
  nextId?: (state: AccessDemoState) => string;
};

type PendingResult = AccessCommandResult | AccessDecisionResult;

function failure(error: string): { success: false; error: string } {
  return { success: false, error };
}

function trustedInstant(clock: AccessTrustedClock): string | null {
  let value: Date | number | string;
  try {
    value = clock();
  } catch {
    return null;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const instant = date.toISOString();
  return isAccessInstant(instant) ? instant : null;
}

function argentinaDate(instant: string): string {
  const date = new Date(new Date(instant).getTime() - 3 * 60 * 60 * 1000);
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function createDefaultIdAllocator(): (state: AccessDemoState) => string {
  let suffix = 1;
  const reserved = new Set<string>();
  return (state) => {
    const persisted = new Set(state.logs.map((log) => log.id));
    while (suffix <= Number.MAX_SAFE_INTEGER) {
      const candidate = `access-log-local-${suffix}`;
      suffix += 1;
      if (!persisted.has(candidate) && !reserved.has(candidate)) {
        reserved.add(candidate);
        return candidate;
      }
    }
    throw new Error("No se pudo asignar un identificador de ingreso local.");
  };
}

/**
 * Async-compatible adapter for the future shared kiosk. It keeps no actor in
 * state and every queued command rechecks the exact frozen ADMIN at execution.
 */
export function createAccessDemoCallbackFactory(options: AccessDemoCallbackFactoryOptions) {
  const allocate = options.nextId ?? createDefaultIdAllocator();
  const clock = options.trustedNow ?? (() => new Date());
  const fixedActor = options.actor;
  let generation = 0;
  const inFlight = new Map<string, Promise<PendingResult>>();

  function authorized(): boolean {
    return isAuthorizedAccessActor(fixedActor);
  }

  function enqueue<T extends PendingResult>(signature: string, execute: (epoch: number) => T): Promise<T> {
    const current = inFlight.get(signature) as Promise<T> | undefined;
    if (current) return current;
    const epoch = generation;
    const task = Promise.resolve().then(() => {
      if (epoch !== generation) return failure("La operación fue cancelada.") as T;
      return execute(epoch);
    }).finally(() => {
      if (inFlight.get(signature) === task) inFlight.delete(signature);
    });
    inFlight.set(signature, task);
    return task;
  }

  function lookupForKiosk(input: string): Promise<AccessLookupResult> {
    // Authorization intentionally precedes input parsing, roster, state, and clock reads.
    if (!authorized()) return Promise.resolve(failure("No autorizado."));
    const trimmed = typeof input === "string" ? input.trim() : "";
    if (!trimmed) return Promise.resolve(failure("Ingresá un identificador."));
    return Promise.resolve().then(() => {
      if (!authorized()) return failure("No autorizado.");
      const students = options.getStudents();
      const now = trustedInstant(clock);
      if (!now) return failure("La hora de confianza no es válida.");
      return lookupAccessStudent(input, students, argentinaDate(now));
    });
  }

  function createManualCheckin(userId: string, decision: AccessDecision): Promise<AccessCommandResult> {
    if (!authorized()) return Promise.resolve(failure("No autorizado."));
    return enqueue(`manual:${userId}:${String(decision)}`, () => {
      if (!authorized()) return failure("No autorizado.");
      const state = options.getState();
      const students = options.getStudents();
      const at = trustedInstant(clock);
      if (!at) return failure("La hora de confianza no es válida.");
      const transition = createManualAccess(state, fixedActor, students, userId, decision, at, () => allocate(state));
      if (transition.result.success) options.commit(transition.state);
      return transition.result;
    }) as Promise<AccessCommandResult>;
  }

  function decideCheckin(logId: string, decision: AccessDecision): Promise<AccessDecisionResult> {
    if (!authorized()) return Promise.resolve(failure("No autorizado."));
    return enqueue(`decide:${logId}:${String(decision)}`, () => {
      if (!authorized()) return failure("No autorizado.");
      const state = options.getState();
      // The future UI needs current roster for display, but a decision only mutates its ledger row.
      options.getStudents();
      const at = trustedInstant(clock);
      if (!at) return failure("La hora de confianza no es válida.");
      const transition = decidePendingAccess(state, fixedActor, logId, decision, at);
      if (transition.result.success) options.commit(transition.state);
      return transition.result;
    }) as Promise<AccessDecisionResult>;
  }

  function history(): AccessHistoryRow[] | null {
    if (!authorized()) return null;
    return projectAccessHistory(options.getState(), fixedActor, options.getStudents());
  }

  function dailyFeed(): AccessDailyFeed | null {
    if (!authorized()) return null;
    const state = options.getState();
    const students = options.getStudents();
    const now = trustedInstant(clock);
    if (!now) return null;
    return projectAccessDailyFeed(state, fixedActor, students, argentinaDate(now), now);
  }

  return {
    lookupForKiosk,
    createManualCheckin,
    decideCheckin,
    getHistory: history,
    getDailyFeed: dailyFeed,
    /** Reset/provider-unmount invalidates queued work without touching other demo domains. */
    cancelPending() {
      generation += 1;
      inFlight.clear();
    },
  };
}

export type AccessDemoCallbacks = ReturnType<typeof createAccessDemoCallbackFactory>;
