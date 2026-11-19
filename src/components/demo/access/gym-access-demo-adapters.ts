// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { applyGymAccessProfileOverrides, createManualGymAccess, decidePendingGymAccess, isAuthorizedGymAccessActor, isGymAccessInstant, lookupGymAccessStudent, projectGymAccessDailyFeed, projectGymAccessHistory } from "./gym-access-demo-state.ts";
import type {
  GymAccessCommandResult,
  GymAccessDailyFeed,
  GymAccessDecision,
  GymAccessDecisionResult,
  GymAccessDemoState,
  GymAccessHistoryRow,
  GymAccessLookupResult,
  GymAccessProfileOverride,
  GymAccessStudent,
} from "./gym-access-demo-types";

export type GymAccessTrustedClock = () => Date | number | string;
export type GymAccessDemoCallbackFactoryOptions = {
  getState: () => GymAccessDemoState;
  /** GYM finance's own detached, current-roster bridge (self-domain, mirrors DemoFinanceProvider.getAccessStudents). */
  getFinanceStudents: () => readonly GymAccessStudent[];
  commit: (state: GymAccessDemoState) => void;
  actorToken: object;
  operatorName: string | null;
  trustedNow?: GymAccessTrustedClock;
  nextId?: (state: GymAccessDemoState) => string;
};

type PendingResult = GymAccessCommandResult | GymAccessDecisionResult;
type Overrides = ReadonlyMap<string, GymAccessProfileOverride>;

function failure(error: string): { success: false; error: string } {
  return { success: false, error };
}

function trustedInstant(clock: GymAccessTrustedClock): string | null {
  let value: Date | number | string;
  try {
    value = clock();
  } catch {
    return null;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const instant = date.toISOString();
  return isGymAccessInstant(instant) ? instant : null;
}

function argentinaDate(instant: string): string {
  const date = new Date(new Date(instant).getTime() - 3 * 60 * 60 * 1000);
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function createDefaultIdAllocator(): (state: GymAccessDemoState) => string {
  let suffix = 1;
  const reserved = new Set<string>();
  return (state) => {
    const persisted = new Set(state.logs.map((log) => log.id));
    while (suffix <= Number.MAX_SAFE_INTEGER) {
      const candidate = `gym-access-log-local-${suffix}`;
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
 * `profileOverrides` travels as a plain, optional, call-time argument on lookup and manual
 * checkin — never stored on this factory's options or cached in a ref here. The caller (the GYM
 * access adapter component) reads DemoGymProfileProvider's `profileState` during render and
 * rebuilds the wrapper it hands to the shared AccessKioskView on every profileState change, the
 * same rule DemoGymFeesAdapter's registerPayment wrapper follows for gymTeacherStudentLinks.
 */
export function createGymAccessDemoCallbackFactory(options: GymAccessDemoCallbackFactoryOptions) {
  const allocate = options.nextId ?? createDefaultIdAllocator();
  const clock = options.trustedNow ?? (() => new Date());
  const actorToken = options.actorToken;
  let generation = 0;
  const inFlight = new Map<string, Promise<PendingResult>>();

  function authorized(): boolean {
    return isAuthorizedGymAccessActor(actorToken);
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

  function lookupForKiosk(input: string, profileOverrides?: Overrides): Promise<GymAccessLookupResult> {
    // Authorization intentionally precedes input parsing, roster, state, and clock reads.
    if (!authorized()) return Promise.resolve(failure("No autorizado."));
    const trimmed = typeof input === "string" ? input.trim() : "";
    if (!trimmed) return Promise.resolve(failure("Ingresá un identificador."));
    return Promise.resolve().then(() => {
      if (!authorized()) return failure("No autorizado.");
      const students = applyGymAccessProfileOverrides(options.getFinanceStudents(), profileOverrides);
      const now = trustedInstant(clock);
      if (!now) return failure("La hora de confianza no es válida.");
      return lookupGymAccessStudent(input, students, argentinaDate(now));
    });
  }

  function createManualCheckin(userId: string, decision: GymAccessDecision, profileOverrides?: Overrides): Promise<GymAccessCommandResult> {
    if (!authorized()) return Promise.resolve(failure("No autorizado."));
    return enqueue(`manual:${userId}:${String(decision)}`, () => {
      if (!authorized()) return failure("No autorizado.");
      const state = options.getState();
      const students = applyGymAccessProfileOverrides(options.getFinanceStudents(), profileOverrides);
      const at = trustedInstant(clock);
      if (!at) return failure("La hora de confianza no es válida.");
      const transition = createManualGymAccess(state, actorToken, students, userId, decision, at, () => allocate(state));
      if (transition.result.success) options.commit(transition.state);
      return transition.result;
    }) as Promise<GymAccessCommandResult>;
  }

  function decideCheckin(logId: string, decision: GymAccessDecision): Promise<GymAccessDecisionResult> {
    if (!authorized()) return Promise.resolve(failure("No autorizado."));
    return enqueue(`decide:${logId}:${String(decision)}`, () => {
      if (!authorized()) return failure("No autorizado.");
      const state = options.getState();
      const at = trustedInstant(clock);
      if (!at) return failure("La hora de confianza no es válida.");
      const transition = decidePendingGymAccess(state, actorToken, logId, decision, at);
      if (transition.result.success) options.commit(transition.state);
      return transition.result;
    }) as Promise<GymAccessDecisionResult>;
  }

  function history(profileOverrides?: Overrides): GymAccessHistoryRow[] | null {
    if (!authorized()) return null;
    const students = applyGymAccessProfileOverrides(options.getFinanceStudents(), profileOverrides);
    return projectGymAccessHistory(options.getState(), actorToken, students, options.operatorName);
  }

  function dailyFeed(profileOverrides?: Overrides): GymAccessDailyFeed | null {
    if (!authorized()) return null;
    const state = options.getState();
    const students = applyGymAccessProfileOverrides(options.getFinanceStudents(), profileOverrides);
    const now = trustedInstant(clock);
    if (!now) return null;
    return projectGymAccessDailyFeed(state, actorToken, students, options.operatorName, argentinaDate(now), now);
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

export type GymAccessDemoCallbacks = ReturnType<typeof createGymAccessDemoCallbackFactory>;
