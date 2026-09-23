// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { isValidGymTrainingDemoState } from "./gym-training-demo-state.ts";
import type { GymTrainingDemoState } from "./gym-training-demo-types";

/** This key owns only the isolated, dated GYM training ledger. */
export const GYM_TRAINING_DEMO_STORAGE_KEY = "wody-gym-training-demo-v1";

export type GymTrainingDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type GymTrainingDemoStorageLoad = {
  state: GymTrainingDemoState;
  warning: string | null;
};

const INVALID_STATE_WARNING = "El estado guardado de entrenamiento no es válido; se restauró el ejemplo.";

type Snapshot = { ok: true; value: unknown } | { ok: false };

const SNAPSHOT_FAILURE: Snapshot = Object.freeze({ ok: false });

/**
 * Captures data descriptors into a privately owned graph before validating or
 * serializing. It deliberately never reads a source property, invokes toJSON,
 * or relies on JSON as a clone operation. Transparent proxies cannot be
 * universally identified, but their admitted descriptor values are detached
 * before the authoritative core validator sees them.
 */
function snapshotValue(value: unknown, ancestors: WeakSet<object>): Snapshot {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { ok: true, value };
  }
  if (typeof value !== "object") return SNAPSHOT_FAILURE;
  try {
    if (ancestors.has(value)) return SNAPSHOT_FAILURE;
    ancestors.add(value);
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return SNAPSHOT_FAILURE;
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 || lengthDescriptor.enumerable) return SNAPSHOT_FAILURE;
      const keys = Reflect.ownKeys(value);
      if (keys.length !== lengthDescriptor.value + 1 || !keys.every((key) => key === "length" || (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < lengthDescriptor.value))) return SNAPSHOT_FAILURE;
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const copy: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return SNAPSHOT_FAILURE;
        const nested = snapshotValue(descriptor.value, ancestors);
        if (!nested.ok) return SNAPSHOT_FAILURE;
        copy.push(nested.value);
      }
      ancestors.delete(value);
      return { ok: true, value: copy };
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return SNAPSHOT_FAILURE;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) return SNAPSHOT_FAILURE;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = descriptors[key as string];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return SNAPSHOT_FAILURE;
      const nested = snapshotValue(descriptor.value, ancestors);
      if (!nested.ok) return SNAPSHOT_FAILURE;
      Object.defineProperty(copy, key, { value: nested.value, enumerable: true, configurable: true, writable: true });
    }
    ancestors.delete(value);
    return { ok: true, value: copy };
  } catch {
    return SNAPSHOT_FAILURE;
  } finally {
    // A failed branch must not make an unrelated alias look like a cycle.
    if (typeof value === "object" && value !== null) {
      try { ancestors.delete(value); } catch { /* hostile proxy identity cannot escape this boundary */ }
    }
  }
}

function snapshotGymTrainingDemoState(state: unknown): GymTrainingDemoState | null {
  const snapshot = snapshotValue(state, new WeakSet<object>());
  return snapshot.ok && isValidGymTrainingDemoState(snapshot.value)
    ? snapshot.value
    : null;
}

/** The core validates only the detached descriptor snapshot, never caller-owned values. */
export function serializeGymTrainingDemoState(state: unknown): string {
  const snapshot = snapshotGymTrainingDemoState(state);
  if (!snapshot) {
    throw new Error("Cannot serialize an invalid gym training demo state.");
  }
  return JSON.stringify(snapshot);
}

/** `null` alone denotes a missing key. Every other byte sequence is persisted corruption. */
export function deserializeGymTrainingDemoState(raw: string | null | undefined): GymTrainingDemoStorageLoad {
  if (raw === null) return { state: createGymTrainingDemoFixture(), warning: null };
  if (typeof raw !== "string") return { state: createGymTrainingDemoFixture(), warning: INVALID_STATE_WARNING };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidGymTrainingDemoState(parsed)
      ? { state: parsed, warning: null }
      : { state: createGymTrainingDemoFixture(), warning: INVALID_STATE_WARNING };
  } catch {
    return { state: createGymTrainingDemoFixture(), warning: INVALID_STATE_WARNING };
  }
}

export function restoreGymTrainingDemoState(raw: string | null | undefined): GymTrainingDemoState {
  return deserializeGymTrainingDemoState(raw).state;
}

/** Recovery is deliberately read-only and asks for no key other than this ledger's key. */
export function loadGymTrainingDemoState(
  storage: GymTrainingDemoStorage | null | undefined,
): GymTrainingDemoStorageLoad {
  if (!storage) {
    return {
      state: createGymTrainingDemoFixture(),
      warning: "El almacenamiento local no está disponible; los cambios no se conservarán.",
    };
  }
  try {
    return deserializeGymTrainingDemoState(storage.getItem(GYM_TRAINING_DEMO_STORAGE_KEY));
  } catch {
    return {
      state: createGymTrainingDemoFixture(),
      warning: "No se pudo leer el almacenamiento local; se usó el estado de respaldo.",
    };
  }
}

/** Storage failures do not compromise the valid in-memory ledger or expose storage payloads. */
export function persistGymTrainingDemoState(
  storage: GymTrainingDemoStorage | null | undefined,
  state: unknown,
): string | null {
  if (!storage) return "El almacenamiento local no está disponible; los cambios no se conservarán.";
  let serialized: string;
  try {
    serialized = serializeGymTrainingDemoState(state);
  } catch {
    return "No se guardó un estado de entrenamiento no válido.";
  }
  try {
    storage.setItem(GYM_TRAINING_DEMO_STORAGE_KEY, serialized);
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
