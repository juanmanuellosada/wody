// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createGymFixedDemoFixture } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { isValidGymFixedDemoState } from "./gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { snapshotDemoStorageValue } from "./demo-storage-snapshot.ts";
import type { GymFixedDemoState } from "./gym-fixed-demo-types";

/** Isolated from the BOX training, finance, access, and turnos ledgers. */
export const GYM_FIXED_DEMO_STORAGE_KEY = "wody-gym-fixed-routines-demo-v1";

export type GymFixedDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type GymFixedDemoStorageLoad = { state: GymFixedDemoState; warning: string | null };

const INVALID_STATE_WARNING = "El estado guardado de rutinas fijas no es válido; se restauró el ejemplo.";

/**
 * Own descriptor snapshots close validate-then-serialize TOCTOU: neither the
 * validator nor JSON sees caller-owned getters, toJSON, or volatile values.
 */
export function serializeGymFixedDemoState(state: unknown): string {
  const snapshot = snapshotDemoStorageValue(state);
  if (!snapshot.ok || !isValidGymFixedDemoState(snapshot.value)) {
    throw new Error("Cannot serialize an invalid gym fixed-routine demo state.");
  }
  return JSON.stringify(snapshot.value);
}

/** JSON parsing always returns detached data and delegates all shape checks to the core validator. */
export function deserializeGymFixedDemoState(raw: string | null | undefined): GymFixedDemoStorageLoad {
  // Storage.getItem signals a genuinely missing key with null. Empty bytes and
  // whitespace are corrupted persisted values, not an absent ledger.
  if (raw === null) return { state: createGymFixedDemoFixture(), warning: null };
  if (typeof raw !== "string") return { state: createGymFixedDemoFixture(), warning: INVALID_STATE_WARNING };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidGymFixedDemoState(parsed)
      ? { state: parsed, warning: null }
      : { state: createGymFixedDemoFixture(), warning: INVALID_STATE_WARNING };
  } catch {
    return { state: createGymFixedDemoFixture(), warning: INVALID_STATE_WARNING };
  }
}

export function restoreGymFixedDemoState(raw: string | null | undefined): GymFixedDemoState {
  return deserializeGymFixedDemoState(raw).state;
}

/** Reads only this ledger key; recovery never writes, removes, or migrates any key. */
export function loadGymFixedDemoState(storage: GymFixedDemoStorage | null | undefined): GymFixedDemoStorageLoad {
  if (!storage) {
    return {
      state: createGymFixedDemoFixture(),
      warning: "El almacenamiento local no está disponible; los cambios no se conservarán.",
    };
  }
  try {
    return deserializeGymFixedDemoState(storage.getItem(GYM_FIXED_DEMO_STORAGE_KEY));
  } catch {
    return {
      state: createGymFixedDemoFixture(),
      warning: "No se pudo leer el almacenamiento local; se usó el estado de respaldo.",
    };
  }
}

/** Persists only the valid isolated ledger and leaves invalid input untouched. */
export function persistGymFixedDemoState(
  storage: GymFixedDemoStorage | null | undefined,
  state: unknown,
): string | null {
  if (!storage) return "El almacenamiento local no está disponible; los cambios no se conservarán.";
  let serialized: string;
  try {
    serialized = serializeGymFixedDemoState(state);
  } catch {
    return "No se guardó un estado de rutinas fijas no válido.";
  }
  try {
    storage.setItem(GYM_FIXED_DEMO_STORAGE_KEY, serialized);
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
