// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymDemoProfileJournalFixture, getValidatedGymDemoProfileJournal } from "./gym-demo-profile-journal.ts";
import type { GymDemoProfileJournal } from "./gym-demo-profile-journal";

/** Own key only: this module neither probes nor coordinates any training/group ledger. */
export const GYM_DEMO_PROFILE_STORAGE_KEY = "wody-gym-profiles-demo-v1";
export type GymDemoProfileStorage = Pick<Storage, "getItem" | "setItem">;
export type GymDemoProfileJournalSource = "stored" | "absent" | "corrupt" | "unavailable";
export type GymDemoProfileJournalLoad = {
  journal: GymDemoProfileJournal;
  warning: string | null;
  source: GymDemoProfileJournalSource;
  /** Exact read bytes are retained for a future trusted coordinator, including corruption. */
  raw: string | null | undefined;
};
/** A restore always yields a usable journal, but never hides that the source bytes were corrupt. */
export type GymDemoProfileJournalRestoration = {
  journal: GymDemoProfileJournal;
  source: GymDemoProfileJournalSource;
};

const INVALID_WARNING = "El diario de perfiles guardado no es válido; se restauró el ejemplo.";
const UNAVAILABLE_WARNING = "El almacenamiento local no está disponible; los cambios no se conservarán.";
const READ_WARNING = "No se pudo leer el almacenamiento local; se usó el estado de respaldo.";

function freshJournal(): GymDemoProfileJournal {
  return createGymDemoProfileJournalFixture();
}

/** JSON serializes only a private, fully validated descriptor capture. */
export function serializeGymDemoProfileJournal(value: unknown): string {
  const journal = getValidatedGymDemoProfileJournal(value);
  if (!journal) throw new Error("Cannot serialize an invalid gym demo profile journal.");
  return JSON.stringify(journal);
}

/** `null` alone is absence. Invalid bytes remain observable as corrupt and are never repaired on load. */
export function deserializeGymDemoProfileJournal(raw: string | null | undefined): GymDemoProfileJournalLoad {
  if (raw === null) return { journal: freshJournal(), warning: null, source: "absent", raw };
  if (typeof raw !== "string") return { journal: freshJournal(), warning: INVALID_WARNING, source: "corrupt", raw };
  try {
    const journal = getValidatedGymDemoProfileJournal(JSON.parse(raw));
    return journal
      ? { journal, warning: null, source: "stored", raw }
      : { journal: freshJournal(), warning: INVALID_WARNING, source: "corrupt", raw };
  } catch {
    return { journal: freshJournal(), warning: INVALID_WARNING, source: "corrupt", raw };
  }
}

/** Unlike a bare journal return, this keeps the corrupt/absent/stored/unavailable signal callers need. */
export function restoreGymDemoProfileJournal(raw: string | null | undefined): GymDemoProfileJournalRestoration {
  const { journal, source } = deserializeGymDemoProfileJournal(raw);
  return { journal, source };
}

/** Read-only recovery: only the journal key is queried; no prune, acknowledgement, migration, or fallback write occurs. */
export function loadGymDemoProfileJournal(storage: GymDemoProfileStorage | null | undefined): GymDemoProfileJournalLoad {
  if (!storage) return { journal: freshJournal(), warning: UNAVAILABLE_WARNING, source: "unavailable", raw: undefined };
  try {
    return deserializeGymDemoProfileJournal(storage.getItem(GYM_DEMO_PROFILE_STORAGE_KEY));
  } catch {
    return { journal: freshJournal(), warning: READ_WARNING, source: "unavailable", raw: undefined };
  }
}

/** Invalid journals perform zero storage IO. Persisting never grants actor permission or applies pending group work. */
export function persistGymDemoProfileJournal(
  storage: GymDemoProfileStorage | null | undefined,
  value: unknown,
): string | null {
  let serialized: string;
  try {
    serialized = serializeGymDemoProfileJournal(value);
  } catch {
    return "No se guardó un diario de perfiles no válido.";
  }
  if (!storage) return UNAVAILABLE_WARNING;
  try {
    storage.setItem(GYM_DEMO_PROFILE_STORAGE_KEY, serialized);
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
