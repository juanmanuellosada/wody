// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { assignGymDemoStudentTeacher, createGymDemoProfileFixture, editGymDemoStudent, getValidatedGymDemoProfileState, setGymDemoStudentBlocked, setGymDemoStudentOwnRoutines, setGymDemoStudentPaymentExempt, setGymDemoStudentType, unassignGymDemoStudentTeacher } from "./gym-demo-profile-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoProfiles } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { snapshotDemoStorageValue } from "../training/demo-storage-snapshot.ts";
import type { GymDemoProfileClock, GymDemoProfileEffect, GymDemoProfileState, GymDemoProfileTransition } from "./gym-demo-profile-core";

/** Closed envelope for profile metadata plus unapplied cross-ledger group-detach intents. */
export const GYM_DEMO_PROFILE_JOURNAL_NAMESPACE = "wody-gym-profile-journal";
export const GYM_DEMO_PROFILE_JOURNAL_VERSION = 1;

export type GymDemoProfileGroupDetachIntent = { studentId: string; revision: number };
export type GymDemoProfileJournal = {
  namespace: typeof GYM_DEMO_PROFILE_JOURNAL_NAMESPACE;
  version: typeof GYM_DEMO_PROFILE_JOURNAL_VERSION;
  revision: number;
  profileState: GymDemoProfileState;
  pendingGroupDetaches: GymDemoProfileGroupDetachIntent[];
};

/** The only accepted operation source: each arm dispatches to the approved profile core. */
export type GymDemoProfileJournalCommand =
  | { type: "EDIT_STUDENT"; actorToken: unknown; input: unknown }
  // R3-001: `clock` is genuinely required (its value may still be `undefined`), matching captureCommand's
  // runtime requirement that the own key be present for SET_BLOCKED; a type-correct command can no longer omit it.
  | { type: "SET_BLOCKED"; actorToken: unknown; input: unknown; clock: GymDemoProfileClock | undefined }
  | { type: "SET_PAYMENT_EXEMPT"; actorToken: unknown; input: unknown }
  | { type: "SET_TYPE"; actorToken: unknown; input: unknown }
  | { type: "SET_OWN_ROUTINES"; actorToken: unknown; input: unknown }
  | { type: "ASSIGN_TEACHER"; actorToken: unknown; input: unknown }
  | { type: "UNASSIGN_TEACHER"; actorToken: unknown; input: unknown };

/** Opaque, process-local ticket; it is not serializable and cannot be reconstructed from fields. */
export type GymDemoProfileJournalTicket = object;
export type GymDemoProfileJournalPreparation =
  | { success: true; transition: "PREPARED"; ticket: GymDemoProfileJournalTicket }
  | { success: false; transition: "UNCHANGED"; ticket: null; journal: GymDemoProfileJournal | null; error: string };
export type GymDemoProfileJournalStage =
  | { success: true; transition: "STAGED"; journal: GymDemoProfileJournal }
  | { success: false; transition: "UNCHANGED"; journal: GymDemoProfileJournal | null; error: string };
export type GymDemoProfileJournalAck =
  | { success: true; transition: "ACKNOWLEDGED"; journal: GymDemoProfileJournal }
  | { success: false; transition: "UNCHANGED"; journal: GymDemoProfileJournal | null; error: string };

type OwnedRecord = Record<string, unknown>;
type CapturedTransition = { state: GymDemoProfileState; result: { success: boolean; error?: string }; effects: GymDemoProfileEffect[] };
type PreparedTicket = { baseRevision: number; baseProfileState: GymDemoProfileState; transition: CapturedTransition };

const MAX_REVISION = Number.MAX_SAFE_INTEGER;
const JOURNAL_INVALID = "El diario de perfiles de demostración no es válido.";
const COMMAND_INVALID = "El comando de perfiles de demostración no es válido.";
const PREPARATION_INVALID = "La preparación de perfiles de demostración no es válida.";
const ACK_INVALID = "La confirmación de grupos de demostración no es válida.";
const activeFullStudentIds = new Set(
  getGymDemoProfiles()
    .filter((profile) => profile.role === "STUDENT" && profile.deletedAt === null && profile.accountKind === "FULL")
    .map((profile) => profile.id),
);
const preparedTickets = new WeakMap<object, PreparedTicket>();

function isPlainRecord(value: unknown): value is OwnedRecord {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function ownStringKeys(value: OwnedRecord): string[] {
  return Reflect.ownKeys(value).filter((key): key is string => typeof key === "string");
}

function hasExactlyKeys(value: OwnedRecord, expected: readonly string[]): boolean {
  const keys = ownStringKeys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isSafeRevision(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= MAX_REVISION;
}

/** Persisted timestamps must already be canonical UTC ISO strings; storage never repairs core bytes. */
function isCanonicalUtcIso(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

function hasCanonicalBlockedAt(state: GymDemoProfileState): boolean {
  return state.students.every((student) => student.blockedAt === null || isCanonicalUtcIso(student.blockedAt));
}

function journalHeaderGuard(keys: readonly (string | symbol)[], descriptors: PropertyDescriptorMap): boolean {
  const expected = ["namespace", "version", "revision", "profileState", "pendingGroupDetaches"];
  if (keys.length !== expected.length || keys.some((key) => typeof key !== "string") || !expected.every((key) => keys.includes(key))) return false;
  const namespace = descriptors.namespace;
  const version = descriptors.version;
  return Boolean(namespace && version && "value" in namespace && "value" in version
    && namespace.value === GYM_DEMO_PROFILE_JOURNAL_NAMESPACE && version.value === GYM_DEMO_PROFILE_JOURNAL_VERSION);
}

function validateOwnedJournal(value: unknown): GymDemoProfileJournal | null {
  if (!isPlainRecord(value) || !hasExactlyKeys(value, ["namespace", "version", "revision", "profileState", "pendingGroupDetaches"])
    || value.namespace !== GYM_DEMO_PROFILE_JOURNAL_NAMESPACE || value.version !== GYM_DEMO_PROFILE_JOURNAL_VERSION
    || !isSafeRevision(value.revision, 0) || !Array.isArray(value.pendingGroupDetaches)) return null;

  const profileState = getValidatedGymDemoProfileState(value.profileState);
  if (!profileState || !hasCanonicalBlockedAt(profileState)) return null;
  const studentIds = new Set<string>();
  const pendingGroupDetaches: GymDemoProfileGroupDetachIntent[] = [];
  for (const intent of value.pendingGroupDetaches) {
    if (!isPlainRecord(intent) || !hasExactlyKeys(intent, ["studentId", "revision"])
      || typeof intent.studentId !== "string" || !activeFullStudentIds.has(intent.studentId)
      || studentIds.has(intent.studentId) || !isSafeRevision(intent.revision, 1) || intent.revision > value.revision) return null;
    studentIds.add(intent.studentId);
    pendingGroupDetaches.push({ studentId: intent.studentId, revision: intent.revision });
  }
  return {
    namespace: GYM_DEMO_PROFILE_JOURNAL_NAMESPACE,
    version: GYM_DEMO_PROFILE_JOURNAL_VERSION,
    revision: value.revision,
    profileState,
    pendingGroupDetaches,
  };
}

/** One descriptor-owned capture, guarded by the root header before any child traversal. */
export function getValidatedGymDemoProfileJournal(value: unknown): GymDemoProfileJournal | null {
  const captured = snapshotDemoStorageValue(value, new WeakSet<object>(), journalHeaderGuard);
  return captured.ok ? validateOwnedJournal(captured.value) : null;
}

export function isValidGymDemoProfileJournal(value: unknown): value is GymDemoProfileJournal {
  return getValidatedGymDemoProfileJournal(value) !== null;
}

/** Initial metadata is the approved core fixture; no group change is applied or acknowledged here. */
export function createGymDemoProfileJournalFixture(): GymDemoProfileJournal {
  const candidate = {
    namespace: GYM_DEMO_PROFILE_JOURNAL_NAMESPACE,
    version: GYM_DEMO_PROFILE_JOURNAL_VERSION,
    revision: 0,
    profileState: createGymDemoProfileFixture(),
    pendingGroupDetaches: [],
  } satisfies GymDemoProfileJournal;
  const journal = getValidatedGymDemoProfileJournal(candidate);
  if (!journal) throw new TypeError("Invalid canonical GYM profile journal fixture.");
  return journal;
}

function captureTransition(value: GymDemoProfileTransition): CapturedTransition | null {
  const captured = snapshotDemoStorageValue(value);
  if (!captured.ok || !isPlainRecord(captured.value) || !hasExactlyKeys(captured.value, ["state", "result", "effects"])) return null;
  const result = captured.value.result;
  if (!isPlainRecord(result) || typeof result.success !== "boolean"
    || (result.success && !hasExactlyKeys(result, ["success"]))
    || (!result.success && (!hasExactlyKeys(result, ["success", "error"]) || typeof result.error !== "string"))) return null;
  const state = getValidatedGymDemoProfileState(captured.value.state);
  if (!state || !hasCanonicalBlockedAt(state) || !Array.isArray(captured.value.effects)) return null;
  const effects: GymDemoProfileEffect[] = [];
  const ids = new Set<string>();
  for (const effect of captured.value.effects) {
    if (!isPlainRecord(effect) || !hasExactlyKeys(effect, ["type", "studentId"])
      || effect.type !== "DETACH_ALL_GROUPS" || typeof effect.studentId !== "string" || ids.has(effect.studentId)) return null;
    ids.add(effect.studentId);
    effects.push({ type: "DETACH_ALL_GROUPS", studentId: effect.studentId });
  }
  return { state, result: result.success ? { success: true } : { success: false, error: result.error as string }, effects };
}

/** Captures only command descriptors; opaque actor tokens remain identities and are used immediately by the core. */
function captureCommand(value: unknown): GymDemoProfileJournalCommand | null {
  if (typeof value !== "object" || value === null) return null;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return null;
    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.length !== Reflect.ownKeys(descriptors).length || keys.some((key) => typeof key !== "string")) return null;
    const descriptor = (key: string): PropertyDescriptor | null => {
      const entry = descriptors[key];
      return entry && "value" in entry && entry.enumerable ? entry : null;
    };
    const typeDescriptor = descriptor("type");
    const actorDescriptor = descriptor("actorToken");
    const inputDescriptor = descriptor("input");
    if (!typeDescriptor || !actorDescriptor || !inputDescriptor || typeof typeDescriptor.value !== "string") return null;
    const expected = typeDescriptor.value === "SET_BLOCKED"
      ? ["type", "actorToken", "input", "clock"]
      : ["type", "actorToken", "input"];
    if (keys.length !== expected.length || !expected.every((key) => keys.includes(key))) return null;
    if (typeDescriptor.value === "SET_BLOCKED") {
      const clockDescriptor = descriptor("clock");
      if (!clockDescriptor || (clockDescriptor.value !== undefined && typeof clockDescriptor.value !== "function")) return null;
      return { type: "SET_BLOCKED", actorToken: actorDescriptor.value, input: inputDescriptor.value, clock: clockDescriptor.value as GymDemoProfileClock | undefined };
    }
    switch (typeDescriptor.value) {
      case "EDIT_STUDENT": return { type: "EDIT_STUDENT", actorToken: actorDescriptor.value, input: inputDescriptor.value };
      case "SET_PAYMENT_EXEMPT": return { type: "SET_PAYMENT_EXEMPT", actorToken: actorDescriptor.value, input: inputDescriptor.value };
      case "SET_TYPE": return { type: "SET_TYPE", actorToken: actorDescriptor.value, input: inputDescriptor.value };
      case "SET_OWN_ROUTINES": return { type: "SET_OWN_ROUTINES", actorToken: actorDescriptor.value, input: inputDescriptor.value };
      case "ASSIGN_TEACHER": return { type: "ASSIGN_TEACHER", actorToken: actorDescriptor.value, input: inputDescriptor.value };
      case "UNASSIGN_TEACHER": return { type: "UNASSIGN_TEACHER", actorToken: actorDescriptor.value, input: inputDescriptor.value };
      default: return null;
    }
  } catch {
    return null;
  }
}

function runCoreCommand(state: GymDemoProfileState, command: GymDemoProfileJournalCommand): GymDemoProfileTransition {
  switch (command.type) {
    case "EDIT_STUDENT": return editGymDemoStudent(state, command.actorToken, command.input);
    case "SET_BLOCKED": return setGymDemoStudentBlocked(state, command.actorToken, command.input, command.clock);
    case "SET_PAYMENT_EXEMPT": return setGymDemoStudentPaymentExempt(state, command.actorToken, command.input);
    case "SET_TYPE": return setGymDemoStudentType(state, command.actorToken, command.input);
    case "SET_OWN_ROUTINES": return setGymDemoStudentOwnRoutines(state, command.actorToken, command.input);
    case "ASSIGN_TEACHER": return assignGymDemoStudentTeacher(state, command.actorToken, command.input);
    case "UNASSIGN_TEACHER": return unassignGymDemoStudentTeacher(state, command.actorToken, command.input);
  }
}

/**
 * Public API: prepare(journal, closed command) -> opaque ticket; stage(journal, ticket) -> journal; ACK is exact.
 * Tickets bind a private base revision and profile snapshot, are consumed once, and never cross persistence.
 */
export function prepareGymDemoProfileJournalCommand(previousJournal: unknown, commandValue: unknown): GymDemoProfileJournalPreparation {
  const previous = getValidatedGymDemoProfileJournal(previousJournal);
  if (!previous) return { success: false, transition: "UNCHANGED", ticket: null, journal: null, error: JOURNAL_INVALID };
  const command = captureCommand(commandValue);
  if (!command) return { success: false, transition: "UNCHANGED", ticket: null, journal: previousJournal as GymDemoProfileJournal, error: COMMAND_INVALID };
  const transition = captureTransition(runCoreCommand(previous.profileState, command));
  if (!transition) return { success: false, transition: "UNCHANGED", ticket: null, journal: previousJournal as GymDemoProfileJournal, error: PREPARATION_INVALID };
  if (!transition.result.success) return { success: false, transition: "UNCHANGED", ticket: null, journal: previousJournal as GymDemoProfileJournal, error: transition.result.error ?? PREPARATION_INVALID };
  const ticket = Object.freeze(Object.create(null));
  preparedTickets.set(ticket, { baseRevision: previous.revision, baseProfileState: previous.profileState, transition });
  return { success: true, transition: "PREPARED", ticket };
}

function sameProfileState(left: GymDemoProfileState, right: GymDemoProfileState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Exported only so journal-level tests can exercise its rejection branch directly (R3-002): through the
 * real, approved core every ticket's captured transition is self-consistent by construction, so this
 * branch is unreachable via the public prepare/stage flow and needs a hand-built ticket to cover.
 */
export function effectsMatchPreparedCommand(prepared: PreparedTicket): boolean {
  const { baseProfileState: previous, transition } = prepared;
  const next = transition.state;
  const effects = transition.effects;
  const introduced = new Set(next.students
    .filter((student) => previous.students.find((before) => before.id === student.id)?.studentType !== "GENERAL" && student.studentType === "GENERAL")
    .map((student) => student.id));
  const validEffects = effects.every((effect) => activeFullStudentIds.has(effect.studentId)
    && next.students.some((student) => student.id === effect.studentId && student.studentType === "GENERAL"));
  if (!validEffects) return false;
  if (introduced.size > 0) return effects.length === introduced.size && effects.every((effect) => introduced.has(effect.studentId));
  // Only a core-issued SET_TYPE GENERAL can have changed the own-routines flag while retaining GENERAL.
  const changedOwnFlagOnly = next.students.every((student) => {
    const before = previous.students.find((candidate) => candidate.id === student.id);
    return Boolean(before && student.id !== effects[0]?.studentId
      ? JSON.stringify(before) === JSON.stringify(student)
      : before && student.id === effects[0]?.studentId
        && before.id === student.id && before.name === student.name && before.studentType === student.studentType
        && before.blockedAt === student.blockedAt && before.paymentExempt === student.paymentExempt && before.paymentExemptReason === student.paymentExemptReason);
  }) && JSON.stringify(previous.links) === JSON.stringify(next.links);
  return effects.length === 0 || (effects.length === 1 && changedOwnFlagOnly);
}

/**
 * Staging is persistence preparation, never authorization. Future ordering is: persist journal+intent,
 * persist group prune, then persist exact ACK. Failures retain the retryable intent; keys are not atomic.
 */
export function stageGymDemoProfileJournal(previousJournal: unknown, ticket: unknown): GymDemoProfileJournalStage {
  const previous = getValidatedGymDemoProfileJournal(previousJournal);
  if (!previous) return { success: false, transition: "UNCHANGED", journal: null, error: JOURNAL_INVALID };
  if (typeof ticket !== "object" || ticket === null) return { success: false, transition: "UNCHANGED", journal: previousJournal as GymDemoProfileJournal, error: PREPARATION_INVALID };
  const prepared = preparedTickets.get(ticket);
  if (!prepared || previous.revision !== prepared.baseRevision || !sameProfileState(previous.profileState, prepared.baseProfileState)
    || previous.revision >= MAX_REVISION || !effectsMatchPreparedCommand(prepared)) {
    return { success: false, transition: "UNCHANGED", journal: previousJournal as GymDemoProfileJournal, error: PREPARATION_INVALID };
  }
  const revision = previous.revision + 1;
  const changedIds = new Set(prepared.transition.effects.map((effect) => effect.studentId));
  const candidate: GymDemoProfileJournal = {
    namespace: GYM_DEMO_PROFILE_JOURNAL_NAMESPACE,
    version: GYM_DEMO_PROFILE_JOURNAL_VERSION,
    revision,
    profileState: prepared.transition.state,
    // Read current pending entries, not preparation-time entries: ACK can occur between prepare and stage.
    pendingGroupDetaches: [
      ...previous.pendingGroupDetaches.filter((intent) => !changedIds.has(intent.studentId)),
      ...prepared.transition.effects.map((effect) => ({ studentId: effect.studentId, revision })),
    ],
  };
  const journal = getValidatedGymDemoProfileJournal(candidate);
  if (!journal) return { success: false, transition: "UNCHANGED", journal: previousJournal as GymDemoProfileJournal, error: PREPARATION_INVALID };
  preparedTickets.delete(ticket);
  return { success: true, transition: "STAGED", journal };
}

/** Exact acknowledgement is permitted only after a future group ledger successfully persists its prune. */
export function acknowledgeGymDemoProfileGroupDetach(previousJournal: unknown, studentId: unknown, intentRevision: unknown): GymDemoProfileJournalAck {
  const previous = getValidatedGymDemoProfileJournal(previousJournal);
  if (!previous) return { success: false, transition: "UNCHANGED", journal: null, error: JOURNAL_INVALID };
  if (typeof studentId !== "string" || !isSafeRevision(intentRevision, 1)) {
    return { success: false, transition: "UNCHANGED", journal: previousJournal as GymDemoProfileJournal, error: ACK_INVALID };
  }
  const index = previous.pendingGroupDetaches.findIndex((intent) => intent.studentId === studentId && intent.revision === intentRevision);
  if (index < 0) return { success: false, transition: "UNCHANGED", journal: previousJournal as GymDemoProfileJournal, error: ACK_INVALID };
  const candidate: GymDemoProfileJournal = {
    namespace: previous.namespace,
    version: previous.version,
    revision: previous.revision,
    profileState: previous.profileState,
    pendingGroupDetaches: previous.pendingGroupDetaches.filter((_, pendingIndex) => pendingIndex !== index),
  };
  const journal = getValidatedGymDemoProfileJournal(candidate);
  return journal
    ? { success: true, transition: "ACKNOWLEDGED", journal }
    : { success: false, transition: "UNCHANGED", journal: previousJournal as GymDemoProfileJournal, error: ACK_INVALID };
}
