// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createPersonalTrainingDemoFixture } from "./personal-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { isValidPersonalTrainingDemoState } from "./personal-training-demo-state.ts";
import type { PersonalTrainingDemoState } from "./personal-training-demo-types";

/** This key is deliberately isolated from BOX, GYM, finance, access, and turnos ledgers. */
export const PERSONAL_TRAINING_DEMO_STORAGE_KEY = "wody-personal-training-demo-v1";

export type PersonalTrainingDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type PersonalTrainingDemoStorageLoad = {
  state: PersonalTrainingDemoState;
  warning: string | null;
};

const INVALID_STATE_WARNING = "El estado guardado de rutinas no es válido; se restauró el ejemplo.";

/** Serializing is permitted only for a complete ledger accepted by the core's closed validator. */
export function serializePersonalTrainingDemoState(state: unknown): string {
  if (!isValidPersonalTrainingDemoState(state)) {
    throw new Error("Cannot serialize an invalid personal training demo state.");
  }
  return JSON.stringify(state);
}

/** `null` alone means an absent key; every other unreadable byte sequence is corrupt storage. */
export function deserializePersonalTrainingDemoState(raw: string | null | undefined): PersonalTrainingDemoStorageLoad {
  if (raw === null) return { state: createPersonalTrainingDemoFixture(), warning: null };
  if (typeof raw !== "string") return { state: createPersonalTrainingDemoFixture(), warning: INVALID_STATE_WARNING };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidPersonalTrainingDemoState(parsed)
      ? { state: parsed, warning: null }
      : { state: createPersonalTrainingDemoFixture(), warning: INVALID_STATE_WARNING };
  } catch {
    return { state: createPersonalTrainingDemoFixture(), warning: INVALID_STATE_WARNING };
  }
}

export function restorePersonalTrainingDemoState(raw: string | null | undefined): PersonalTrainingDemoState {
  return deserializePersonalTrainingDemoState(raw).state;
}

/** Reads only the PERSONAL key. Recovery is read-only and never migrates or removes data. */
export function loadPersonalTrainingDemoState(
  storage: PersonalTrainingDemoStorage | null | undefined,
): PersonalTrainingDemoStorageLoad {
  if (!storage) {
    return {
      state: createPersonalTrainingDemoFixture(),
      warning: "El almacenamiento local no está disponible; los cambios no se conservarán.",
    };
  }
  try {
    return deserializePersonalTrainingDemoState(storage.getItem(PERSONAL_TRAINING_DEMO_STORAGE_KEY));
  } catch {
    return {
      state: createPersonalTrainingDemoFixture(),
      warning: "No se pudo leer el almacenamiento local; se usó el estado de respaldo.",
    };
  }
}

/** Invalid state never reaches storage; write failures leave the in-memory ledger usable. */
export function persistPersonalTrainingDemoState(
  storage: PersonalTrainingDemoStorage | null | undefined,
  state: unknown,
): string | null {
  if (!storage) return "El almacenamiento local no está disponible; los cambios no se conservarán.";
  let serialized: string;
  try {
    serialized = serializePersonalTrainingDemoState(state);
  } catch {
    return "No se guardó un estado de rutinas no válido.";
  }
  try {
    storage.setItem(PERSONAL_TRAINING_DEMO_STORAGE_KEY, serialized);
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
