// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_FINANCE_DEMO_STORAGE_KEY } from "./finance-demo-types.ts";
import type { GymFinanceDemoState } from "./finance-demo-types";

/** Owns only the isolated GYM finance ledger; BOX migrations are intentionally not consulted. */
export { GYM_FINANCE_DEMO_STORAGE_KEY };

export type GymFinanceDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type GymFinanceDemoStorageLoad = { state: GymFinanceDemoState; warning: string | null };

const INVALID_STATE_WARNING = "El estado financiero guardado no es válido; se restauró el ejemplo.";
const UNAVAILABLE_WARNING = "El almacenamiento local no está disponible; los cambios no se conservarán.";

/**
 * An optional anchor is trusted fixture configuration for deterministic callers,
 * not persisted data. Invalid configuration fails closed rather than returning
 * a fixture that the GYM core would reject as valid.
 */
function createFreshGymFinanceDemoState(anchor?: unknown): GymFinanceDemoState {
  try {
    const candidate = anchor === undefined
      ? createGymFinanceDemoFixture()
      : typeof anchor === "string"
        ? createGymFinanceDemoFixture(anchor)
        : null;
    const snapshot = candidate === null ? null : getValidatedGymFinanceDemoState(candidate);
    if (!snapshot) throw new Error("Invalid trusted GYM finance fixture configuration.");
    return snapshot;
  } catch {
    throw new TypeError("Invalid trusted GYM finance fixture configuration.");
  }
}

/**
 * The core captures an owned descriptor snapshot before validation. JSON sees
 * only that private graph, never a caller-owned getter, proxy read, or toJSON.
 */
export function serializeGymFinanceDemoState(state: unknown): string {
  const snapshot = getValidatedGymFinanceDemoState(state);
  if (!snapshot) throw new Error("Cannot serialize an invalid gym finance demo state.");
  return JSON.stringify(snapshot);
}

/** `null` alone is Storage's missing-key signal; every other raw value is corrupt persisted data. */
export function deserializeGymFinanceDemoState(
  raw: string | null | undefined,
  anchor?: string,
): GymFinanceDemoStorageLoad {
  if (raw === null) return { state: createFreshGymFinanceDemoState(anchor), warning: null };
  if (typeof raw !== "string") return { state: createFreshGymFinanceDemoState(anchor), warning: INVALID_STATE_WARNING };
  try {
    const parsed: unknown = JSON.parse(raw);
    const restored = getValidatedGymFinanceDemoState(parsed);
    return restored
      ? { state: restored, warning: null }
      : { state: createFreshGymFinanceDemoState(anchor), warning: INVALID_STATE_WARNING };
  } catch {
    return { state: createFreshGymFinanceDemoState(anchor), warning: INVALID_STATE_WARNING };
  }
}

export function restoreGymFinanceDemoState(raw: string | null | undefined, anchor?: string): GymFinanceDemoState {
  return deserializeGymFinanceDemoState(raw, anchor).state;
}

/** Recovery reads exactly one owned key and never repairs, removes, or migrates storage. */
export function loadGymFinanceDemoState(
  storage: GymFinanceDemoStorage | null | undefined,
  anchor?: string,
): GymFinanceDemoStorageLoad {
  if (!storage) return { state: createFreshGymFinanceDemoState(anchor), warning: UNAVAILABLE_WARNING };
  try {
    return deserializeGymFinanceDemoState(storage.getItem(GYM_FINANCE_DEMO_STORAGE_KEY), anchor);
  } catch {
    return {
      state: createFreshGymFinanceDemoState(anchor),
      warning: "No se pudo leer el almacenamiento local; se usó el estado de respaldo.",
    };
  }
}

/** Invalid values never reach storage; successful bytes always come from the core-owned snapshot. */
export function persistGymFinanceDemoState(
  storage: GymFinanceDemoStorage | null | undefined,
  state: unknown,
): string | null {
  if (!storage) return UNAVAILABLE_WARNING;
  let serialized: string;
  try {
    serialized = serializeGymFinanceDemoState(state);
  } catch {
    return "No se guardó un estado financiero no válido.";
  }
  try {
    storage.setItem(GYM_FINANCE_DEMO_STORAGE_KEY, serialized);
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
