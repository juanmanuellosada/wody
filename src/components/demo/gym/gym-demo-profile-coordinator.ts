// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { acknowledgeGymDemoProfileGroupDetach, getValidatedGymDemoProfileJournal, prepareGymDemoProfileJournalCommand, stageGymDemoProfileJournal } from "./gym-demo-profile-journal.ts";
import type { GymDemoProfileJournal } from "./gym-demo-profile-journal";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { persistGymDemoProfileJournal } from "./gym-demo-profile-storage.ts";
import type { GymDemoProfileStorage } from "./gym-demo-profile-storage";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { removeGymTrainingStudentFromGroup } from "../training/gym-training-demo-state.ts";
import type { GymTrainingDemoState } from "../training/gym-training-demo-types";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { persistGymTrainingDemoState } from "../training/gym-training-demo-storage.ts";
import type { GymTrainingDemoStorage } from "../training/gym-training-demo-storage";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_ADMIN_ID, getGymDemoActorToken } from "../scenarios/gym-demo-directory.ts";

/**
 * Applies the journal's declarative DETACH_ALL_GROUPS effects to the isolated dated-training ledger
 * (the sole owner of GYM group membership; see gym-training-demo-state.ts/-types.ts). This module owns
 * no storage key of its own: it only orchestrates the two already-approved, already-owned ledgers
 * (wody-gym-profiles-demo-v1 and wody-gym-training-demo-v1) through their existing storage functions.
 * It never reads, writes, or references the GYM finance ledger: finance.students stays a projection,
 * never a profile authority, and no finance storage handle is accepted here.
 * No UI, route, or React component lives in this file; a later unit wires a provider around it.
 */

export type GymDemoProfileCoordinatorIO = {
  profileStorage: GymDemoProfileStorage | null | undefined;
  trainingStorage: GymTrainingDemoStorage | null | undefined;
};

export type GymDemoProfileReconcileOutcome = {
  journal: GymDemoProfileJournal;
  trainingState: GymTrainingDemoState;
  /** First warning encountered this pass, if any; a pass with nothing pending is always null. */
  warning: string | null;
  /** Student IDs whose pending detach was pruned, persisted, acknowledged, and persisted again this pass. */
  resolvedStudentIds: readonly string[];
  /** Student IDs still pending after this pass; safe and expected to retry on a later call. */
  pendingStudentIds: readonly string[];
};

export type GymDemoProfileCommandOutcome =
  | {
      success: true;
      error: null;
      journal: GymDemoProfileJournal;
      trainingState: GymTrainingDemoState;
      warning: string | null;
      resolvedStudentIds: readonly string[];
      pendingStudentIds: readonly string[];
    }
  | {
      success: false;
      error: string;
      journal: GymDemoProfileJournal | null;
      trainingState: GymTrainingDemoState;
      warning: null;
      resolvedStudentIds: readonly string[];
      pendingStudentIds: readonly string[];
    };

const EMPTY_IDS: readonly string[] = Object.freeze([]);
const SYSTEM_ACTOR_UNAVAILABLE = "No se pudo aplicar la baja de grupos: el actor del sistema no está disponible.";
const PRUNE_REJECTED_WARNING = "No se pudo desvincular a un alumno de sus grupos; el cambio queda pendiente.";

/**
 * The invoking actor of a profile command (e.g. a TEACHER) may not manage every group a student
 * belongs to: group ownership is per-teacher, and a MUSCULACION_LIBRE membership can be added by any
 * staff member managing a group, regardless of that student's assigned teacher. Production-parity
 * `removeGymTrainingStudentFromGroup` authorizes an ADMIN to manage any group unconditionally, so the
 * canonical GYM admin is used as a fixed system identity for this one internal cross-ledger prune step
 * only. It is derived here, never accepted as a caller-supplied parameter, and it never substitutes for
 * the actor token that authorized the profile command itself.
 */
function systemGroupPruneActorToken(): object | null {
  return getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
}

/**
 * Reconciles every pending group-detach intent already recorded in `journal` against `trainingState`.
 * Idempotent by construction: a student with no remaining memberships takes zero mutating passes, and
 * an intent already absent from `journal.pendingGroupDetaches` is never revisited. A durability failure
 * on one intent never blocks or rolls back another; each intent's outcome is independent within the pass.
 */
export function reconcileGymDemoProfilePendingGroupDetaches(
  io: GymDemoProfileCoordinatorIO,
  journal: GymDemoProfileJournal,
  trainingState: GymTrainingDemoState,
): GymDemoProfileReconcileOutcome {
  const systemActorToken = systemGroupPruneActorToken();
  let nextJournal = journal;
  let nextTraining = trainingState;
  const resolvedStudentIds: string[] = [];
  const pendingStudentIds: string[] = [];
  let warning: string | null = null;

  // A snapshot of the intents present at entry: resolving one never adds or removes another mid-pass.
  for (const intent of journal.pendingGroupDetaches) {
    if (!systemActorToken) {
      pendingStudentIds.push(intent.studentId);
      warning = warning ?? SYSTEM_ACTOR_UNAVAILABLE;
      continue;
    }

    // Idempotent prune: memberships are re-read from the latest committed ledger on every pass, so an
    // already-pruned student (from an earlier pass, complete or partial) contributes zero removals here.
    const memberships = nextTraining.memberships.filter((membership) => membership.studentId === intent.studentId);
    let prunedTraining = nextTraining;
    let rejected = false;
    for (const membership of memberships) {
      const removal = removeGymTrainingStudentFromGroup(prunedTraining, systemActorToken, intent.studentId, membership.groupId);
      if (!removal.result.success) { rejected = true; break; }
      prunedTraining = removal.state;
    }
    if (rejected) {
      pendingStudentIds.push(intent.studentId);
      warning = warning ?? PRUNE_REJECTED_WARNING;
      continue;
    }

    if (prunedTraining !== nextTraining) {
      // The cross-key write. Only commit the pruned ledger into the returned/in-memory state once it is
      // durable: a failed write here must never advance in-memory state past what storage actually holds.
      const trainingWarning = persistGymTrainingDemoState(io.trainingStorage, prunedTraining);
      if (trainingWarning) {
        pendingStudentIds.push(intent.studentId);
        warning = warning ?? trainingWarning;
        continue;
      }
      nextTraining = prunedTraining;
    }

    const ack = acknowledgeGymDemoProfileGroupDetach(nextJournal, intent.studentId, intent.revision);
    if (!ack.success) {
      // The prune already landed durably (or was already a no-op); never roll back a write that landed.
      pendingStudentIds.push(intent.studentId);
      warning = warning ?? ack.error;
      continue;
    }
    const journalWarning = persistGymDemoProfileJournal(io.profileStorage, ack.journal);
    if (journalWarning) {
      // The prune is durable; the acknowledgement is not. journal.pendingGroupDetaches still shows the
      // intent, so the next reconcile pass retries only the acknowledgement (its own prune step is a no-op).
      pendingStudentIds.push(intent.studentId);
      warning = warning ?? journalWarning;
      continue;
    }
    nextJournal = ack.journal;
    resolvedStudentIds.push(intent.studentId);
  }

  return {
    journal: nextJournal,
    trainingState: nextTraining,
    warning,
    resolvedStudentIds: Object.freeze(resolvedStudentIds),
    pendingStudentIds: Object.freeze(pendingStudentIds),
  };
}

/**
 * Prepares, stages, and journals a profile command, then reconciles every currently pending group
 * detach (the new one included) against the training ledger. The staged journal — carrying the new
 * pending intent, if any — is persisted before any training-ledger write is attempted: an interrupted
 * or reloaded session always finds the intent already durable, never silently dropped.
 */
export function applyGymDemoProfileCommand(
  io: GymDemoProfileCoordinatorIO,
  previousJournal: unknown,
  previousTrainingState: GymTrainingDemoState,
  commandValue: unknown,
): GymDemoProfileCommandOutcome {
  const prepared = prepareGymDemoProfileJournalCommand(previousJournal, commandValue);
  if (!prepared.success) {
    return {
      success: false,
      error: prepared.error,
      journal: prepared.journal,
      trainingState: previousTrainingState,
      warning: null,
      resolvedStudentIds: EMPTY_IDS,
      pendingStudentIds: prepared.journal ? prepared.journal.pendingGroupDetaches.map((intent) => intent.studentId) : EMPTY_IDS,
    };
  }
  const staged = stageGymDemoProfileJournal(previousJournal, prepared.ticket);
  if (!staged.success) {
    return {
      success: false,
      error: staged.error,
      journal: staged.journal,
      trainingState: previousTrainingState,
      warning: null,
      resolvedStudentIds: EMPTY_IDS,
      pendingStudentIds: staged.journal ? staged.journal.pendingGroupDetaches.map((intent) => intent.studentId) : EMPTY_IDS,
    };
  }

  // Ordering invariant: the pending intent is durably journaled before any training-ledger write.
  const stageWarning = persistGymDemoProfileJournal(io.profileStorage, staged.journal);
  if (stageWarning) {
    // The staged journal (carrying the new pending intent) never became durable: reconcile must not
    // run, so zero training-ledger writes happen against an intent that a reload could still lose.
    // In-memory state must not advance past what storage actually holds, so both previous values are
    // returned as-is rather than the staged journal.
    const previous = getValidatedGymDemoProfileJournal(previousJournal);
    return {
      success: false,
      error: stageWarning,
      journal: previous,
      trainingState: previousTrainingState,
      warning: null,
      resolvedStudentIds: EMPTY_IDS,
      pendingStudentIds: previous ? previous.pendingGroupDetaches.map((intent) => intent.studentId) : EMPTY_IDS,
    };
  }
  const reconciled = reconcileGymDemoProfilePendingGroupDetaches(io, staged.journal, previousTrainingState);

  return {
    success: true,
    error: null,
    journal: reconciled.journal,
    trainingState: reconciled.trainingState,
    warning: reconciled.warning,
    resolvedStudentIds: reconciled.resolvedStudentIds,
    pendingStudentIds: reconciled.pendingStudentIds,
  };
}
