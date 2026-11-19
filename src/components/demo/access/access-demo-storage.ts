// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createAccessDemoFixture } from "./access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { isValidAccessDemoState } from "./access-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { ACCESS_DEMO_STORAGE_KEY } from "./access-demo-types.ts";
import type { AccessDemoState } from "./access-demo-types";

export type AccessDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type AccessStorageLoad = { state: AccessDemoState; warning: string | null };

function safeFallback(fallback?: unknown): AccessDemoState {
  return isValidAccessDemoState(fallback) ? fallback : createAccessDemoFixture();
}

export function serializeAccessDemoState(state: AccessDemoState): string {
  if (!isValidAccessDemoState(state)) throw new Error("Cannot serialize an invalid access demo state.");
  return JSON.stringify(state);
}

export function resolveAccessDemoInitialState(raw: string | null | undefined, fallback?: unknown): AccessStorageLoad {
  const safe = safeFallback(fallback);
  if (!raw) return { state: safe, warning: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidAccessDemoState(parsed)) return { state: parsed, warning: null };
  } catch {
    // Invalid or unavailable persisted bytes never trigger a destructive write.
  }
  return { state: safe, warning: "El estado de accesos guardado no es válido; se usó el estado de respaldo." };
}

/** Reading is strictly non-destructive and checks only the access namespace. */
export function loadAccessDemoState(storage: AccessDemoStorage | null | undefined, fallback?: unknown): AccessStorageLoad {
  const safe = safeFallback(fallback);
  if (!storage) return { state: safe, warning: "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán." };
  try {
    return resolveAccessDemoInitialState(storage.getItem(ACCESS_DEMO_STORAGE_KEY), safe);
  } catch {
    return { state: safe, warning: "No se pudo leer el almacenamiento de accesos; se usó el estado de respaldo." };
  }
}

/** Persistence owns only wody-box-access-demo-v1 and never reads, deletes, or migrates finance keys. */
export function persistAccessDemoState(storage: AccessDemoStorage | null | undefined, state: AccessDemoState): string | null {
  if (!storage) return "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.";
  try {
    storage.setItem(ACCESS_DEMO_STORAGE_KEY, serializeAccessDemoState(state));
    return null;
  } catch {
    return "No se pudieron guardar los cambios de accesos; el demo continúa solo en memoria.";
  }
}
