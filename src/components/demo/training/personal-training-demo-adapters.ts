// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { copyPersonalTrainingWod, createPersonalTrainingWod, deletePersonalTrainingWod, getPersonalTrainingActorToken, isValidPersonalTrainingDemoState, updatePersonalTrainingWod } from "./personal-training-demo-state.ts";
import type {
  PersonalTrainingDemoState,
  PersonalTrainingWodResult,
  PersonalTrainingWodTarget,
} from "./personal-training-demo-types";

export type PersonalTrainingCallbackFactoryOptions = {
  getState: () => PersonalTrainingDemoState;
  commit: (state: PersonalTrainingDemoState) => void;
  /** The opaque core capability, not a UI actor object or a reconstructed identity. */
  personalActorToken: unknown;
  nextId?: (state: PersonalTrainingDemoState) => string;
  now?: () => Date;
};

/** Exact positional callback contracts accepted by WodManagerView for a locked PERSONAL target. */
export type PersonalTrainingViewCallbacks = {
  onCreateWod: (date: string, title: string, content: string, target: PersonalTrainingWodTarget) => Promise<PersonalTrainingWodResult>;
  onUpdateWod: (wodId: string, title: string, content: string, date?: string, target?: PersonalTrainingWodTarget) => Promise<PersonalTrainingWodResult>;
  onDeleteWod: (wodId: string) => Promise<PersonalTrainingWodResult>;
  onCopyWod: (sourceWodId: string, targetDate: string, target?: PersonalTrainingWodTarget) => Promise<PersonalTrainingWodResult>;
  /** Lets a future provider reset or unmount invalidate queued local work. */
  cancelPending: () => void;
};

type PendingOperation = {
  key: string;
  generation: number;
  promise: Promise<unknown>;
};

const CANONICAL_ACTOR = getPersonalTrainingActorToken();
const MAX_ID_ATTEMPTS = 64;
const MAX_ID_LENGTH = 64;
const ID_PREFIX = "personal-wod-";
const PROBE_DATE = new Date("2000-01-01T00:00:00.000Z");

function resultFailure(error: string): PersonalTrainingWodResult {
  return { success: false, error };
}

function pendingFailure(): PersonalTrainingWodResult {
  return resultFailure("Hay otra operación de rutinas en curso.");
}

function cancelledFailure(): PersonalTrainingWodResult {
  return resultFailure("La operación de rutinas fue cancelada.");
}

function isCallbackId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH && value.trim() === value;
}

function isAllocatedId(value: unknown): value is string {
  return isCallbackId(value) && value.startsWith(ID_PREFIX) && value.length > ID_PREFIX.length;
}

function readLockedTarget(value: unknown): PersonalTrainingWodTarget | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const names = Object.getOwnPropertyNames(value);
    if (Object.getOwnPropertySymbols(value).length !== 0 || names.length !== 2 || !names.includes("type") || !names.includes("studentId")) return null;
    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    }
    const target = value as { type: unknown; studentId: unknown };
    return target.type === "STUDENT" && target.studentId === "personal-student-owner"
      ? { type: "STUDENT", studentId: "personal-student-owner" }
      : null;
  } catch {
    return null;
  }
}

function keyPart(value: string | undefined): string {
  return value === undefined ? "-" : `${value.length}:${value}`;
}

function invocationKey(operation: string, values: readonly (string | undefined)[]): string {
  return `${operation}|${values.map(keyPart).join("|")}`;
}

function targetKey(target: PersonalTrainingWodTarget | undefined): [string | undefined, string | undefined] {
  return target === undefined ? [undefined, undefined] : [target.type, target.studentId];
}

/**
 * Local-only action adapters. The fixed reference comparison happens before
 * inspecting user arguments or invoking injected dependencies.
 */
export function createPersonalTrainingCallbackFactory(
  options: PersonalTrainingCallbackFactoryOptions,
): PersonalTrainingViewCallbacks {
  const actorToken = options.personalActorToken;
  const customNextId = options.nextId;
  const now = options.now ?? (() => new Date());
  const reservedIds = new Set<string>();
  let generation = 0;
  let pending: PendingOperation | null = null;

  function authorized(): boolean {
    return actorToken === CANONICAL_ACTOR;
  }

  function currentValidState(): PersonalTrainingDemoState | null {
    const state = options.getState();
    return isValidPersonalTrainingDemoState(state) ? state : null;
  }

  function defaultId(state: PersonalTrainingDemoState): string {
    const occupied = new Set(state.wods.map((wod) => wod.id));
    let suffix = 1;
    while (occupied.has(`${ID_PREFIX}${suffix}`) || reservedIds.has(`${ID_PREFIX}${suffix}`)) suffix += 1;
    return `${ID_PREFIX}${suffix}`;
  }

  function allocateId(state: PersonalTrainingDemoState): string | null {
    const occupied = new Set(state.wods.map((wod) => wod.id));
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
      const candidate = customNextId ? customNextId(state) : defaultId(state);
      if (isAllocatedId(candidate) && !occupied.has(candidate) && !reservedIds.has(candidate)) {
        reservedIds.add(candidate);
        return candidate;
      }
    }
    return null;
  }

  function commitResult(transition: { state: PersonalTrainingDemoState; result: PersonalTrainingWodResult }): PersonalTrainingWodResult {
    if (transition.result.success) options.commit(transition.state);
    return transition.result;
  }

  function invoke(key: string, execute: () => PersonalTrainingWodResult): Promise<PersonalTrainingWodResult> {
    if (pending) {
      return pending.key === key && pending.generation === generation
        ? pending.promise as Promise<PersonalTrainingWodResult>
        : Promise.resolve(pendingFailure());
    }
    const operationGeneration = generation;
    const entry = {} as PendingOperation;
    const promise = Promise.resolve().then(() => {
      if (operationGeneration !== generation) return cancelledFailure();
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

  return {
    onCreateWod(date, title, content, target) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      const lockedTarget = readLockedTarget(target);
      if (typeof date !== "string" || typeof title !== "string" || typeof content !== "string" || !lockedTarget) {
        return Promise.resolve(resultFailure("La rutina no es válida."));
      }
      const [targetType, targetStudentId] = targetKey(lockedTarget);
      const key = invocationKey("create", [date, title, content, targetType, targetStudentId]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("Estado de rutinas inválido.");
        const id = allocateId(state);
        if (!id) return resultFailure("No se pudo generar un identificador de rutina único.");
        return commitResult(createPersonalTrainingWod(state, actorToken, { id, date, title, content, target: lockedTarget }));
      });
    },

    onUpdateWod(wodId, title, content, date, target) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      const lockedTarget = target === undefined ? undefined : readLockedTarget(target);
      if (!isCallbackId(wodId) || typeof title !== "string" || typeof content !== "string" || (date !== undefined && typeof date !== "string") || (target !== undefined && !lockedTarget)) {
        return Promise.resolve(resultFailure("La rutina no es válida."));
      }
      const resolvedTarget = lockedTarget ?? undefined;
      const [targetType, targetStudentId] = targetKey(resolvedTarget);
      const key = invocationKey("update", [wodId, title, content, date, targetType, targetStudentId]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("Estado de rutinas inválido.");
        return commitResult(updatePersonalTrainingWod(state, actorToken, {
          wodId,
          title,
          content,
          ...(date === undefined ? {} : { date }),
          ...(resolvedTarget === undefined ? {} : { target: resolvedTarget }),
        }));
      });
    },

    onDeleteWod(wodId) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      if (!isCallbackId(wodId)) return Promise.resolve(resultFailure("La rutina no es válida."));
      const key = invocationKey("delete", [wodId]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("Estado de rutinas inválido.");
        const command = { wodId };
        const probe = deletePersonalTrainingWod(state, actorToken, command, () => PROBE_DATE);
        if (!probe.result.success) return probe.result;
        // Intentionally uncaught: a trusted injected clock failure must be observable.
        const clockValue = now();
        return commitResult(deletePersonalTrainingWod(state, actorToken, command, () => clockValue));
      });
    },

    onCopyWod(sourceWodId, targetDate, target) {
      if (!authorized()) return Promise.resolve(resultFailure("No autorizado."));
      const lockedTarget = target === undefined ? undefined : readLockedTarget(target);
      if (!isCallbackId(sourceWodId) || typeof targetDate !== "string" || (target !== undefined && !lockedTarget)) {
        return Promise.resolve(resultFailure("La rutina no es válida."));
      }
      const resolvedTarget = lockedTarget ?? undefined;
      const [targetType, targetStudentId] = targetKey(resolvedTarget);
      const key = invocationKey("copy", [sourceWodId, targetDate, targetType, targetStudentId]);
      return invoke(key, () => {
        if (!authorized()) return resultFailure("No autorizado.");
        const state = currentValidState();
        if (!state) return resultFailure("Estado de rutinas inválido.");
        const id = allocateId(state);
        if (!id) return resultFailure("No se pudo generar un identificador de rutina único.");
        return commitResult(copyPersonalTrainingWod(state, actorToken, {
          id,
          sourceWodId,
          targetDate,
          ...(resolvedTarget === undefined ? {} : { target: resolvedTarget }),
        }));
      });
    },

    cancelPending() {
      generation += 1;
      pending = null;
    },
  };
}
