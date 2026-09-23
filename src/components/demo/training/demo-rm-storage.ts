import type { DemoRmKind, DemoRmState } from "./demo-rm-types";

export const GYM_DEMO_RM_STORAGE_KEY = "wody-gym-rms-demo-v1";
export const PERSONAL_DEMO_RM_STORAGE_KEY = "wody-personal-rms-demo-v1";

export type DemoRmStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type DemoRmStorageLoad = { state: DemoRmState; warning: string | null };

export type DemoRmStorageCore = {
  readonly kind: DemoRmKind;
  emptyState(): DemoRmState;
  resetState(fixture?: unknown): DemoRmState | null;
  isValidState(state: unknown): boolean;
};

const INVALID_STATE_WARNING = "El estado guardado de PRs no es válido; se restauró el ejemplo.";
const UNAVAILABLE_WARNING = "El almacenamiento local no está disponible; los cambios no se conservarán.";

function keyForTrustedKind(kind: DemoRmKind): string {
  if (kind === "GYM") return GYM_DEMO_RM_STORAGE_KEY;
  if (kind === "PERSONAL") return PERSONAL_DEMO_RM_STORAGE_KEY;
  throw new TypeError("Invalid demo RM storage kind.");
}

/**
 * Binds storage to one already-composed core. The namespace and owner set are
 * deliberately never accepted from persisted bytes or callback arguments.
 */
export function createDemoRmStorageAdapter(core: DemoRmStorageCore, fixture?: unknown) {
  const key = keyForTrustedKind(core.kind);
  const fallback = fixture === undefined ? null : core.resetState(fixture);
  if (fixture !== undefined && !fallback) throw new TypeError("Invalid demo RM storage fixture.");

  function freshFallback(): DemoRmState {
    if (fallback) return core.resetState(fallback) as DemoRmState;
    return core.emptyState();
  }

  function invalidLoad(): DemoRmStorageLoad {
    return { state: freshFallback(), warning: INVALID_STATE_WARNING };
  }

  function serialize(state: unknown): string {
    // Validate before JSON.stringify so hostile shapes never reach persistence.
    if (!core.isValidState(state)) throw new Error("Cannot serialize an invalid demo RM state.");
    return JSON.stringify(state);
  }

  function deserialize(raw: string | null | undefined): DemoRmStorageLoad {
    // `null` is the sole absent-key signal defined by Storage.getItem.
    if (raw === null) return { state: freshFallback(), warning: null };
    if (typeof raw !== "string") return invalidLoad();
    try {
      const parsed: unknown = JSON.parse(raw);
      const restored = core.resetState(parsed);
      return restored ? { state: restored, warning: null } : invalidLoad();
    } catch {
      return invalidLoad();
    }
  }

  function load(storage: DemoRmStorage | null | undefined): DemoRmStorageLoad {
    if (!storage) return { state: freshFallback(), warning: UNAVAILABLE_WARNING };
    try {
      // Recovery reads only its bound key and never repairs, migrates, or deletes.
      return deserialize(storage.getItem(key));
    } catch {
      return { state: freshFallback(), warning: "No se pudo leer el almacenamiento local; se usó el estado de respaldo." };
    }
  }

  function persist(storage: DemoRmStorage | null | undefined, state: unknown): string | null {
    if (!storage) return UNAVAILABLE_WARNING;
    let serialized: string;
    try {
      serialized = serialize(state);
    } catch {
      return "No se guardó un estado de PRs no válido.";
    }
    try {
      storage.setItem(key, serialized);
      return null;
    } catch {
      return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
    }
  }

  return Object.freeze({ key, serialize, deserialize, load, persist });
}
