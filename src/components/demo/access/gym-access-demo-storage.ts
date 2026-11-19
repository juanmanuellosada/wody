// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createGymAccessDemoFixture } from "./gym-access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { isValidGymAccessDemoState } from "./gym-access-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_ACCESS_DEMO_STORAGE_KEY } from "./gym-access-demo-types.ts";
import type { GymAccessDemoState } from "./gym-access-demo-types";

export type GymAccessDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type GymAccessStorageLoad = { state: GymAccessDemoState; warning: string | null };

function safeFallback(fallback?: unknown): GymAccessDemoState {
  return isValidGymAccessDemoState(fallback) ? fallback : createGymAccessDemoFixture();
}

export function serializeGymAccessDemoState(state: GymAccessDemoState): string {
  if (!isValidGymAccessDemoState(state)) throw new Error("Cannot serialize an invalid GYM access demo state.");
  return JSON.stringify(state);
}

export function resolveGymAccessDemoInitialState(raw: string | null | undefined, fallback?: unknown): GymAccessStorageLoad {
  const safe = safeFallback(fallback);
  if (!raw) return { state: safe, warning: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidGymAccessDemoState(parsed)) return { state: parsed, warning: null };
  } catch {
    // Invalid or unavailable persisted bytes never trigger a destructive write.
  }
  return { state: safe, warning: "El estado de accesos guardado no es válido; se usó el estado de respaldo." };
}

/** Reading is strictly non-destructive and checks only the GYM access namespace; never BOX's. */
export function loadGymAccessDemoState(storage: GymAccessDemoStorage | null | undefined, fallback?: unknown): GymAccessStorageLoad {
  const safe = safeFallback(fallback);
  if (!storage) return { state: safe, warning: "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán." };
  try {
    return resolveGymAccessDemoInitialState(storage.getItem(GYM_ACCESS_DEMO_STORAGE_KEY), safe);
  } catch {
    return { state: safe, warning: "No se pudo leer el almacenamiento de accesos; se usó el estado de respaldo." };
  }
}

/** Persistence owns only wody-gym-access-demo-v1 and never reads, deletes, or migrates BOX/Personal keys. */
export function persistGymAccessDemoState(storage: GymAccessDemoStorage | null | undefined, state: GymAccessDemoState): string | null {
  if (!storage) return "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.";
  try {
    storage.setItem(GYM_ACCESS_DEMO_STORAGE_KEY, serializeGymAccessDemoState(state));
    return null;
  } catch {
    return "No se pudieron guardar los cambios de accesos; el demo continúa solo en memoria.";
  }
}
