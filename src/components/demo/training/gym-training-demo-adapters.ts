// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { assignGymTrainingStudentToGroup, copyGymTrainingWod, createGymTrainingGroup, createGymTrainingWod, deleteGymTrainingGroup, deleteGymTrainingWod, isValidGymTrainingDemoState, removeGymTrainingStudentFromGroup, renameGymTrainingGroup, updateGymTrainingWod } from "./gym-training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { isDatedTrainingId } from "./dated-training-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type {
  GymTrainingDemoState,
  GymTrainingGroupResult,
  GymTrainingWodResult,
  GymTrainingWodTarget,
} from "./gym-training-demo-types";
import type { GymDemoCanonicalActor } from "../scenarios/gym-demo-directory";

export type GymTrainingCallbackFactoryOptions = {
  getState: () => GymTrainingDemoState;
  commit: (state: GymTrainingDemoState) => void;
  /** A canonical directory capability, never a display profile or a role claim. */
  gymActorToken: unknown;
  /** One shared allocator keeps local WOD and group identifiers collision-free. */
  getId?: (kind: "wod" | "group", state: GymTrainingDemoState) => string;
  now?: () => Date;
};

/** Exact dated-WOD and group callback contracts consumed by the shared views. */
export type GymTrainingViewCallbacks = {
  onCreateWod: (date: string, title: string, content: string, target: GymTrainingWodTarget) => Promise<GymTrainingWodResult>;
  onUpdateWod: (wodId: string, title: string, content: string, date?: string, target?: GymTrainingWodTarget) => Promise<GymTrainingWodResult>;
  onDeleteWod: (wodId: string) => Promise<GymTrainingWodResult>;
  onCopyWod: (sourceWodId: string, targetDate: string, target?: GymTrainingWodTarget) => Promise<GymTrainingWodResult>;
  onCreateGroup: (name: string) => Promise<GymTrainingGroupResult>;
  onRenameGroup: (groupId: string, name: string) => Promise<GymTrainingGroupResult>;
  onDeleteGroup: (groupId: string) => Promise<GymTrainingGroupResult>;
  onAssignStudentToGroup: (studentId: string, groupId: string) => Promise<GymTrainingGroupResult>;
  onRemoveStudentFromGroup: (studentId: string, groupId: string) => Promise<GymTrainingGroupResult>;
  /** Invalidates queued local work when a future provider resets or unmounts. */
  cancelPending: () => void;
};

type PendingOperation = { key: string; generation: number; promise: Promise<unknown> };
type SafeTarget = GymTrainingWodTarget | null;

const MAX_ID_ATTEMPTS = 64;
const PROBE_DELETED_AT = "2000-01-01T00:00:00.000Z";
const NOT_AUTHORIZED = "No autorizado.";
const INVALID_STATE = "El estado de entrenamiento no es válido.";
const BUSY = "Hay otra operación de rutinas en curso.";
const CANCELLED = "La operación de rutinas fue cancelada.";

function wodFailure(error: string): GymTrainingWodResult {
  return { success: false, error };
}

function groupFailure(error: string): GymTrainingGroupResult {
  return { success: false, error };
}

function keyPart(value: string): string {
  return `${value.length}:${value}`;
}

function invocationKey(operation: string, values: readonly string[]): string {
  return `${operation}|${values.map(keyPart).join("|")}`;
}

function capturedText(value: unknown): string {
  return typeof value === "string" ? value : "<invalid>";
}

/**
 * Reads only own enumerable data fields. Invalid or hostile targets become a
 * safe core-invalid sentinel, so no getter or proxy failure can escape.
 */
function snapshotTarget(value: unknown): SafeTarget {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (!keys.every((key) => {
      const descriptor = descriptors[key as string];
      return descriptor && "value" in descriptor && descriptor.enumerable;
    })) return null;
    const type = descriptors.type;
    if (!type || !("value" in type) || typeof type.value !== "string") return null;
    const readId = (name: "groupId" | "studentId"): string | null => {
      const descriptor = descriptors[name];
      return descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value : null;
    };
    if ((type.value === "ALL" || type.value === "PERSONALIZED") && keys.length === 1 && keys[0] === "type") return { type: type.value };
    if ((type.value === "GROUP" || type.value === "MUSCULACION_LIBRE_GROUP") && keys.length === 2 && keys.includes("groupId")) {
      const groupId = readId("groupId");
      return groupId === null ? null : { type: type.value, groupId } as GymTrainingWodTarget;
    }
    if ((type.value === "STUDENT" || type.value === "MUSCULACION_LIBRE") && keys.length === 2 && keys.includes("studentId")) {
      const studentId = readId("studentId");
      return studentId === null ? null : { type: type.value, studentId } as GymTrainingWodTarget;
    }
    return null;
  } catch {
    return null;
  }
}

function targetKey(target: SafeTarget | undefined): readonly string[] {
  if (target === undefined) return ["<undefined>"];
  if (target === null) return ["<invalid>"];
  if (target.type === "GROUP" || target.type === "MUSCULACION_LIBRE_GROUP") return [target.type, target.groupId];
  if (target.type === "STUDENT" || target.type === "MUSCULACION_LIBRE") return [target.type, target.studentId];
  return [target.type];
}

function coreTarget(target: SafeTarget): unknown {
  return target ?? { type: "<invalid>" };
}

function isStaff(actor: GymDemoCanonicalActor): boolean {
  return actor.role === "ADMIN" || actor.role === "TEACHER";
}

function ownsWod(state: GymTrainingDemoState, actor: GymDemoCanonicalActor, wodId: unknown): boolean {
  return typeof wodId === "string" && state.wods.some((wod) => wod.id === wodId && wod.teacherId === actor.id);
}

function managesGroup(state: GymTrainingDemoState, actor: GymDemoCanonicalActor, groupId: unknown): boolean {
  return typeof groupId === "string" && state.groups.some((group) => group.id === groupId && group.deletedAt === null && (actor.role === "ADMIN" || group.teacherId === actor.id));
}

/**
 * The adapter owns queueing and opaque capability binding only. The state
 * kernel remains authoritative for dates, title/content, targets, ownership,
 * and all business-result wording.
 */
export function createGymTrainingCallbackFactory(
  options: GymTrainingCallbackFactoryOptions,
): GymTrainingViewCallbacks {
  const actorToken = options.gymActorToken;
  const getId = options.getId;
  const now = options.now ?? (() => new Date());
  const reservedIds = new Set<string>();
  let generation = 0;
  let pending: PendingOperation | null = null;

  function actor(): GymDemoCanonicalActor | null {
    const resolved = resolveGymDemoActor(actorToken);
    return resolved && isStaff(resolved) ? resolved : null;
  }

  function validState(): GymTrainingDemoState | null {
    const state = options.getState();
    return isValidGymTrainingDemoState(state) ? state : null;
  }

  function defaultId(kind: "wod" | "group", state: GymTrainingDemoState): string {
    const occupied = new Set([...state.wods, ...state.groups].map((entry) => entry.id));
    let suffix = 1;
    while (occupied.has(`gym-training-${kind}-${suffix}`) || reservedIds.has(`gym-training-${kind}-${suffix}`)) suffix += 1;
    return `gym-training-${kind}-${suffix}`;
  }

  function allocateId(kind: "wod" | "group", state: GymTrainingDemoState): string | null {
    const occupied = new Set([...state.wods, ...state.groups].map((entry) => entry.id));
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
      const candidate = getId ? getId(kind, state) : defaultId(kind, state);
      if (isDatedTrainingId(candidate) && !occupied.has(candidate) && !reservedIds.has(candidate)) {
        reservedIds.add(candidate);
        return candidate;
      }
    }
    return null;
  }

  function pendingDecision<R extends GymTrainingWodResult | GymTrainingGroupResult>(key: string, busyResult: R): Promise<R> | null {
    if (!pending) return null;
    return pending.key === key && pending.generation === generation
      ? pending.promise as Promise<R>
      : Promise.resolve(busyResult);
  }

  function invoke<R extends GymTrainingWodResult | GymTrainingGroupResult>(key: string, execute: () => R): Promise<R> {
    const pendingResult = pendingDecision(key, (key.startsWith("group|") || key.startsWith("rename|") || key.startsWith("assign|") || key.startsWith("remove|") || key.startsWith("delete-group|") ? groupFailure(BUSY) : wodFailure(BUSY)) as R);
    if (pendingResult) return pendingResult;
    const operationGeneration = generation;
    const entry = {} as PendingOperation;
    const promise = Promise.resolve().then(() => {
      if (operationGeneration !== generation) {
        return (key.startsWith("group|") || key.startsWith("rename|") || key.startsWith("assign|") || key.startsWith("remove|") || key.startsWith("delete-group|") ? groupFailure(CANCELLED) : wodFailure(CANCELLED)) as R;
      }
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

  function commitWod(transition: { state: GymTrainingDemoState; result: GymTrainingWodResult }): GymTrainingWodResult {
    if (transition.result.success) options.commit(transition.state);
    return transition.result;
  }

  function commitGroup(transition: { state: GymTrainingDemoState; result: GymTrainingGroupResult }): GymTrainingGroupResult {
    if (transition.result.success) options.commit(transition.state);
    return transition.result;
  }

  function preflightWod(actorValue: GymDemoCanonicalActor, wodId: unknown, error: string): GymTrainingWodResult | null {
    const state = validState();
    if (!state) return wodFailure(INVALID_STATE);
    return ownsWod(state, actorValue, wodId) ? null : wodFailure(error);
  }

  function preflightGroup(actorValue: GymDemoCanonicalActor, groupId: unknown): GymTrainingGroupResult | null {
    const state = validState();
    if (!state) return groupFailure(INVALID_STATE);
    return managesGroup(state, actorValue, groupId) ? null : groupFailure("Grupo no encontrado.");
  }

  return {
    onCreateWod(date, title, content, target) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(wodFailure(NOT_AUTHORIZED));
      const safeTarget = snapshotTarget(target);
      const key = invocationKey("create", [capturedText(date), capturedText(title), capturedText(content), ...targetKey(safeTarget)]);
      return invoke(key, () => {
        if (!actor()) return wodFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return wodFailure(INVALID_STATE);
        const id = allocateId("wod", state);
        if (!id) return wodFailure("No se pudo generar un identificador de rutina único.");
        return commitWod(createGymTrainingWod(state, actorToken, id, date, title, content, coreTarget(safeTarget)));
      });
    },

    onUpdateWod(wodId, title, content, date, target) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(wodFailure(NOT_AUTHORIZED));
      // While busy, a guarded snapshot distinguishes an exact replay without any state or ownership read.
      if (pending) {
        const pendingTarget = target === undefined ? undefined : snapshotTarget(target);
        const pendingKey = invocationKey("update", [capturedText(wodId), capturedText(title), capturedText(content), date === undefined ? "<undefined>" : capturedText(date), ...targetKey(pendingTarget)]);
        return pendingDecision(pendingKey, wodFailure(BUSY))!;
      }
      const preflight = preflightWod(actorValue, wodId, "Rutina no encontrada.");
      if (preflight) return Promise.resolve(preflight);
      const safeTarget = target === undefined ? undefined : snapshotTarget(target);
      const key = invocationKey("update", [capturedText(wodId), capturedText(title), capturedText(content), date === undefined ? "<undefined>" : capturedText(date), ...targetKey(safeTarget)]);
      return invoke(key, () => {
        if (!actor()) return wodFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return wodFailure(INVALID_STATE);
        return commitWod(updateGymTrainingWod(state, actorToken, wodId, title, content, date, safeTarget === undefined ? undefined : coreTarget(safeTarget)));
      });
    },

    onDeleteWod(wodId) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(wodFailure(NOT_AUTHORIZED));
      const key = invocationKey("delete", [capturedText(wodId)]);
      const pendingResult = pendingDecision(key, wodFailure(BUSY));
      if (pendingResult) return pendingResult;
      const preflight = preflightWod(actorValue, wodId, "Rutina no encontrada.");
      if (preflight) return Promise.resolve(preflight);
      return invoke(key, () => {
        if (!actor()) return wodFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return wodFailure(INVALID_STATE);
        return commitWod(deleteGymTrainingWod(state, actorToken, wodId));
      });
    },

    onCopyWod(sourceWodId, targetDate, target) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(wodFailure(NOT_AUTHORIZED));
      if (pending) {
        const pendingTarget = target === undefined ? undefined : snapshotTarget(target);
        const pendingKey = invocationKey("copy", [capturedText(sourceWodId), capturedText(targetDate), ...targetKey(pendingTarget)]);
        return pendingDecision(pendingKey, wodFailure(BUSY))!;
      }
      const preflight = preflightWod(actorValue, sourceWodId, "Rutina origen no encontrada.");
      if (preflight) return Promise.resolve(preflight);
      // Source ownership is established before looking at a caller target or constructing its signature.
      const safeTarget = target === undefined ? undefined : snapshotTarget(target);
      const key = invocationKey("copy", [capturedText(sourceWodId), capturedText(targetDate), ...targetKey(safeTarget)]);
      return invoke(key, () => {
        if (!actor()) return wodFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return wodFailure(INVALID_STATE);
        const id = allocateId("wod", state);
        if (!id) return wodFailure("No se pudo generar un identificador de rutina único.");
        return commitWod(copyGymTrainingWod(state, actorToken, id, sourceWodId, targetDate, safeTarget === undefined ? undefined : coreTarget(safeTarget)));
      });
    },

    onCreateGroup(name) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(groupFailure(NOT_AUTHORIZED));
      const key = invocationKey("group", [capturedText(name)]);
      return invoke(key, () => {
        if (!actor()) return groupFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return groupFailure(INVALID_STATE);
        const id = allocateId("group", state);
        if (!id) return groupFailure("No se pudo generar un identificador de grupo único.");
        return commitGroup(createGymTrainingGroup(state, actorToken, id, name));
      });
    },

    onRenameGroup(groupId, name) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(groupFailure(NOT_AUTHORIZED));
      const key = invocationKey("rename", [capturedText(groupId), capturedText(name)]);
      const pendingResult = pendingDecision(key, groupFailure(BUSY));
      if (pendingResult) return pendingResult;
      const preflight = preflightGroup(actorValue, groupId);
      if (preflight) return Promise.resolve(preflight);
      return invoke(key, () => {
        if (!actor()) return groupFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return groupFailure(INVALID_STATE);
        return commitGroup(renameGymTrainingGroup(state, actorToken, groupId, name));
      });
    },

    onDeleteGroup(groupId) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(groupFailure(NOT_AUTHORIZED));
      const key = invocationKey("delete-group", [capturedText(groupId)]);
      const pendingResult = pendingDecision(key, groupFailure(BUSY));
      if (pendingResult) return pendingResult;
      const preflight = preflightGroup(actorValue, groupId);
      if (preflight) return Promise.resolve(preflight);
      return invoke(key, () => {
        if (!actor()) return groupFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return groupFailure(INVALID_STATE);
        // The core's pure transition proves the operation before an injected clock can run.
        const probe = deleteGymTrainingGroup(state, actorToken, groupId, PROBE_DELETED_AT);
        if (!probe.result.success) return probe.result;
        const deletedAt = now().toISOString();
        return commitGroup(deleteGymTrainingGroup(state, actorToken, groupId, deletedAt));
      });
    },

    onAssignStudentToGroup(studentId, groupId) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(groupFailure(NOT_AUTHORIZED));
      const key = invocationKey("assign", [capturedText(studentId), capturedText(groupId)]);
      const pendingResult = pendingDecision(key, groupFailure(BUSY));
      if (pendingResult) return pendingResult;
      const preflight = preflightGroup(actorValue, groupId);
      if (preflight) return Promise.resolve(preflight);
      return invoke(key, () => {
        if (!actor()) return groupFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return groupFailure(INVALID_STATE);
        return commitGroup(assignGymTrainingStudentToGroup(state, actorToken, studentId, groupId));
      });
    },

    onRemoveStudentFromGroup(studentId, groupId) {
      const actorValue = actor();
      if (!actorValue) return Promise.resolve(groupFailure(NOT_AUTHORIZED));
      const key = invocationKey("remove", [capturedText(studentId), capturedText(groupId)]);
      const pendingResult = pendingDecision(key, groupFailure(BUSY));
      if (pendingResult) return pendingResult;
      const preflight = preflightGroup(actorValue, groupId);
      if (preflight) return Promise.resolve(preflight);
      return invoke(key, () => {
        if (!actor()) return groupFailure(NOT_AUTHORIZED);
        const state = validState();
        if (!state) return groupFailure(INVALID_STATE);
        return commitGroup(removeGymTrainingStudentFromGroup(state, actorToken, studentId, groupId));
      });
    },

    cancelPending() {
      generation += 1;
      pending = null;
    },
  };
}
