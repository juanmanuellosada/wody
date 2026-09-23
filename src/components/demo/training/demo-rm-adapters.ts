import type {
  DemoRmActorToken,
  DemoRmProjectionResult,
  DemoRmResult,
  DemoRmState,
} from "./demo-rm-types";

export type DemoRmCallbackCore = {
  getActorToken(ownerId: unknown): DemoRmActorToken | null;
  isValidState(state: unknown): boolean;
  createRm(state: unknown, actor: unknown, command: unknown): { state: unknown; result: DemoRmResult };
  updateRm(state: unknown, actor: unknown, command: unknown): { state: unknown; result: DemoRmResult };
  deleteRm(state: unknown, actor: unknown, id: unknown): { state: unknown; result: DemoRmResult };
  projectRms(state: unknown, actor: unknown): DemoRmProjectionResult;
};

export type DemoRmCallbackFactoryOptions = {
  /** A trusted, already-composed core instance; never a UI actor payload. */
  core: DemoRmCallbackCore;
  fixedOwnerId: string;
  fixedOpaqueToken: unknown;
  getState: () => DemoRmState;
  commit: (state: DemoRmState) => void;
  nextId?: (state: DemoRmState) => string;
};

/** Exact callback signatures consumed by RmsView and RmFormView. */
export type DemoRmViewCallbacks = {
  onCreateRm: (formData: FormData) => Promise<DemoRmResult>;
  onUpdateRm: (rmId: string, formData: FormData) => Promise<DemoRmResult>;
  onDeleteRm: (rmId: string) => Promise<DemoRmResult>;
  /** Lets a future provider reset/unmount invalidate queued local work. */
  cancelPending: () => void;
};

type PendingOperation = { key: string; generation: number; promise: Promise<DemoRmResult> };
type FormFields = { exercise: string; weight: string; date: string };

const MAX_ID_ATTEMPTS = 64;
const ID_PREFIX = "demo-rm-local-";
const NOT_AUTHORIZED = "No autorizado.";
const NOT_FOUND = "PR no encontrado.";
const INVALID_FORM = "El PR no es válido.";
const INVALID_STATE = "El estado de PRs no es valido.";

function failure(error: string): DemoRmResult {
  return { success: false, error };
}

function busyFailure(): DemoRmResult {
  return failure("Hay otra operación de PRs en curso.");
}

function cancelledFailure(): DemoRmResult {
  return failure("La operación de PRs fue cancelada.");
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function keyPart(value: string): string {
  return `${value.length}:${value}`;
}

function invocationKey(operation: string, values: readonly string[]): string {
  return `${operation}|${values.map(keyPart).join("|")}`;
}

/**
 * Reads FormData exactly once using its native first-value semantics. This is
 * intentionally after authorization (and, for updates, ownership) has been
 * established, so foreign records cannot trigger field hooks.
 */
function snapshotFormFields(formData: unknown): FormFields | null {
  try {
    if (formData === null || (typeof formData !== "object" && typeof formData !== "function")) return null;
    const get = (formData as { get?: unknown }).get;
    if (typeof get !== "function") return null;
    const exercise = get.call(formData, "exercise");
    const weight = get.call(formData, "weight");
    const date = get.call(formData, "date");
    if (typeof exercise !== "string" || typeof weight !== "string" || typeof date !== "string") return null;
    return { exercise, weight, date };
  } catch {
    return null;
  }
}

/**
 * Local-only FormData adapters. The token equality check occurs before any
 * state, form, ID-generator, or user-controlled argument inspection.
 */
export function createDemoRmCallbackFactory(options: DemoRmCallbackFactoryOptions): DemoRmViewCallbacks {
  const core = options.core;
  const fixedOwnerId = options.fixedOwnerId;
  const fixedOpaqueToken = options.fixedOpaqueToken;
  const customNextId = options.nextId;
  const reservedIds = new Set<string>();
  let generation = 0;
  let pending: PendingOperation | null = null;

  function authorized(): boolean {
    // The token is capability identity, not reconstructible actor data.
    return fixedOpaqueToken !== null && fixedOpaqueToken === core.getActorToken(fixedOwnerId);
  }

  function currentProjection(): { state: DemoRmState; projection: DemoRmProjectionResult } {
    const state = options.getState();
    return { state, projection: core.projectRms(state, fixedOpaqueToken) };
  }

  function ownsId(projection: DemoRmProjectionResult, id: string): DemoRmResult | null {
    if (!projection.success) return failure(projection.error);
    return projection.rms.some((row) => row.id === id) ? null : failure(NOT_FOUND);
  }

  function defaultId(state: DemoRmState): string {
    const occupied = new Set(state.rms.map((row) => row.id));
    let suffix = 1;
    while (occupied.has(`${ID_PREFIX}${suffix}`) || reservedIds.has(`${ID_PREFIX}${suffix}`)) suffix += 1;
    return `${ID_PREFIX}${suffix}`;
  }

  function allocateId(state: DemoRmState): string | null {
    const occupied = new Set(state.rms.map((row) => row.id));
    for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
      const candidate = customNextId ? customNextId(state) : defaultId(state);
      if (validId(candidate) && !occupied.has(candidate) && !reservedIds.has(candidate)) {
        reservedIds.add(candidate);
        return candidate;
      }
    }
    return null;
  }

  function commitTransition(transition: { state: unknown; result: DemoRmResult }): DemoRmResult {
    if (transition.result.success) options.commit(transition.state as DemoRmState);
    return transition.result;
  }

  function invoke(key: string, execute: () => DemoRmResult): Promise<DemoRmResult> {
    if (pending) {
      return pending.key === key && pending.generation === generation ? pending.promise : Promise.resolve(busyFailure());
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
    onCreateRm(formData) {
      if (!authorized()) return Promise.resolve(failure(NOT_AUTHORIZED));
      const fields = snapshotFormFields(formData);
      if (!fields) return Promise.resolve(failure(INVALID_FORM));
      const key = invocationKey("create", [fields.exercise, fields.weight, fields.date]);
      return invoke(key, () => {
        if (!authorized()) return failure(NOT_AUTHORIZED);
        const { state, projection } = currentProjection();
        if (!projection.success) return failure(projection.error);
        if (!core.isValidState(state)) return failure(INVALID_STATE);
        const id = allocateId(state);
        if (!id) return failure("No se pudo generar un identificador de PR único.");
        return commitTransition(core.createRm(state, fixedOpaqueToken, { id, ...fields }));
      });
    },

    onUpdateRm(rmId, formData) {
      if (!authorized()) return Promise.resolve(failure(NOT_AUTHORIZED));
      if (!validId(rmId)) return Promise.resolve(failure(NOT_FOUND));
      const initial = currentProjection();
      const initialOwnership = ownsId(initial.projection, rmId);
      if (initialOwnership) return Promise.resolve(initialOwnership);
      const fields = snapshotFormFields(formData);
      if (!fields) return Promise.resolve(failure(INVALID_FORM));
      const key = invocationKey("update", [rmId, fields.exercise, fields.weight, fields.date]);
      return invoke(key, () => {
        if (!authorized()) return failure(NOT_AUTHORIZED);
        const current = currentProjection();
        const ownership = ownsId(current.projection, rmId);
        if (ownership) return ownership;
        return commitTransition(core.updateRm(current.state, fixedOpaqueToken, { id: rmId, ...fields }));
      });
    },

    onDeleteRm(rmId) {
      if (!authorized()) return Promise.resolve(failure(NOT_AUTHORIZED));
      if (!validId(rmId)) return Promise.resolve(failure(NOT_FOUND));
      const initial = currentProjection();
      const initialOwnership = ownsId(initial.projection, rmId);
      if (initialOwnership) return Promise.resolve(initialOwnership);
      return invoke(invocationKey("delete", [rmId]), () => {
        if (!authorized()) return failure(NOT_AUTHORIZED);
        const current = currentProjection();
        const ownership = ownsId(current.projection, rmId);
        if (ownership) return ownership;
        return commitTransition(core.deleteRm(current.state, fixedOpaqueToken, rmId));
      });
    },

    cancelPending() {
      generation += 1;
      pending = null;
    },
  };
}
