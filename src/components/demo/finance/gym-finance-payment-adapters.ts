import type {
  PaymentRegistrationCallback,
  PaymentRegistrationOptions,
  PaymentRegistrationResult,
} from "@/components/payments/RegisterPaymentDialogView";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { actorMatchesOwnedFinanceState, isGymFinanceActor, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type { GymFinanceTeacherStudentLink } from "./finance-demo-policy";
import type { GymFinanceDemoState } from "./finance-demo-types";

type GymPaymentIdKind = "payment" | "command";
type PaymentIds = Readonly<{ paymentId: string; commandId: string }>;
type DuplicateBinding = Readonly<{ signature: string }> & PaymentIds;
type PendingPayment = { signature: string; generation: number; promise: Promise<PaymentRegistrationResult> };
type PaymentInput = Readonly<{
  studentId: unknown;
  amountInput: unknown;
  nextPaymentDate: unknown;
  paidAt: unknown;
  paymentMethod: unknown;
  confirmedDuplicate: unknown;
}>;

export type GymFinancePaymentCallbackFactoryOptions = {
  getState: () => GymFinanceDemoState;
  commit: (state: GymFinanceDemoState) => void;
  /** Opaque canonical directory token; structural actor claims are never accepted. */
  gymActorToken: unknown;
  /** Trusted deterministic clock for the later GYM provider. */
  today?: () => string;
  /** Test-only deterministic identifier source; reservations remain factory-private. */
  nextId?: (kind: GymPaymentIdKind, state: GymFinanceDemoState) => string;
  /**
   * Live profile-bridge link accessor, read fresh once per execution (never
   * captured at factory creation) so authorization stays in agreement with
   * whatever link set the Cuotas scoping projection is showing right now.
   * Omitted, the reducer falls back to the canonical directory link set.
   */
  getGymTeacherStudentLinks?: () => readonly GymFinanceTeacherStudentLink[];
};

/** The dialog keeps this shape while the future GYM provider owns reset/unmount wiring. */
export type GymFinancePaymentCallback = PaymentRegistrationCallback & {
  cancelPending: () => void;
  cancelPendingDuplicate: () => void;
};

const MAX_ID_ATTEMPTS = 64;
const INVALID_STATE = "El estado financiero no es válido.";
const NO_AUTHORIZATION = "No autorizado.";
const INVALID_CONFIRMATION = "La confirmación de pago ya no es válida.";
const BUSY = "Hay un pago en curso. Esperá un momento.";
const CANCELLED = "El pago fue restablecido antes de registrarse.";
const ID_FAILURE = "No se pudo asignar un identificador financiero local.";

function failure(error: string): PaymentRegistrationResult {
  return { success: false, error };
}

function valuePart(value: unknown): string {
  if (typeof value === "string") return `s:${value.length}:${value}`;
  if (typeof value === "boolean") return value ? "b:1" : "b:0";
  if (typeof value === "number") return Number.isFinite(value) ? `n:${value}` : "n:invalid";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return `other:${typeof value}`;
}

/** Does not inspect the opaque actor token; identity is fixed by the private resolver. */
function requestSignature(actorId: string, input: PaymentInput): string {
  return [
    `actor:${actorId.length}:${actorId}`,
    valuePart(input.studentId),
    valuePart(input.amountInput),
    valuePart(input.nextPaymentDate),
    valuePart(input.paidAt),
    valuePart(input.paymentMethod),
  ].join("|");
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function createDefaultIdSource(): (kind: GymPaymentIdKind) => string {
  const suffix: Record<GymPaymentIdKind, number> = { payment: 1, command: 1 };
  return (kind) => `gym-finance-${kind}-local-${suffix[kind]++}`;
}

function occupiedPaymentIds(state: GymFinanceDemoState): Set<string> {
  return new Set(state.payments.flatMap((payment) => [payment.id, payment.commandId]));
}

/**
 * The bound attempts count source invocations, not the length of a returned ID.
 * All candidates, including failed/cancelled ones, remain reserved for this factory.
 */
function allocateId(
  state: GymFinanceDemoState,
  kind: GymPaymentIdKind,
  source: (kind: GymPaymentIdKind, state: GymFinanceDemoState) => string,
  reserved: ReadonlySet<string>,
): string | null {
  const occupied = occupiedPaymentIds(state);
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    // Trusted custom dependency failures intentionally propagate to the caller.
    const candidate = source(kind, state);
    if (isId(candidate) && !occupied.has(candidate) && !reserved.has(candidate)) return candidate;
  }
  return null;
}

function toInput(
  studentId: string,
  amountInput: string,
  nextPaymentDate: string,
  options: PaymentRegistrationOptions,
): PaymentInput | null {
  try {
    return {
      studentId,
      amountInput,
      nextPaymentDate,
      paidAt: options.paidAtStr,
      paymentMethod: options.paymentMethod,
      confirmedDuplicate: options.confirmedDuplicate,
    };
  } catch {
    return null;
  }
}

function command(input: PaymentInput, actor: unknown, ids: PaymentIds) {
  return {
    id: ids.paymentId,
    commandId: ids.commandId,
    actor,
    studentId: input.studentId,
    amountInput: input.amountInput,
    paidAt: input.paidAt,
    nextPaymentDate: input.nextPaymentDate,
    paymentMethod: input.paymentMethod,
    confirmedDuplicate: input.confirmedDuplicate,
  };
}

/**
 * Local GYM payment adapter. It captures the private GYM actor once, snapshots
 * the current owned ledger once per queued invocation, and delegates every
 * business decision to the shared payment reducer.
 */
export function createGymFinancePaymentCallbackFactory(
  options: GymFinancePaymentCallbackFactoryOptions,
): GymFinancePaymentCallback {
  const actorToken = options.gymActorToken;
  // Do not fall through to the BOX structural resolver for an unrecognized token:
  // a GYM callback accepts only this directory's private identity.
  const canonicalActor = resolveGymDemoActor(actorToken);
  const actor = canonicalActor && (canonicalActor.role === "ADMIN" || canonicalActor.role === "TEACHER")
    ? resolveFinanceDemoActor(actorToken)
    : null;
  const authorizedActor = actor && isGymFinanceActor(actor) ? actor : null;
  const defaultId = createDefaultIdSource();
  const source = options.nextId ?? ((kind: GymPaymentIdKind) => defaultId(kind));
  const reservedIds = new Set<string>();
  let probeNumber = 0;
  let generation = 0;
  let pending: PendingPayment | null = null;
  let pendingDuplicate: DuplicateBinding | null = null;
  let replayBinding: DuplicateBinding | null = null;

  function clearDuplicateBindings() {
    pendingDuplicate = null;
    replayBinding = null;
  }

  /** Both dialog dismissal and provider reset invalidate queued work atomically. */
  function cancelCurrentWork() {
    generation += 1;
    pending = null;
    clearDuplicateBindings();
  }

  function isCurrent(operationGeneration: number): boolean {
    return operationGeneration === generation;
  }

  function freshProbeIds(state: GymFinanceDemoState): { paymentId: string; commandId: string } {
    const occupied = occupiedPaymentIds(state);
    do { probeNumber += 1; } while (occupied.has(`gym-finance-probe-payment-${probeNumber}`) || occupied.has(`gym-finance-probe-command-${probeNumber}`));
    return {
      paymentId: `gym-finance-probe-payment-${probeNumber}`,
      commandId: `gym-finance-probe-command-${probeNumber}`,
    };
  }

  function resolveToday(state: GymFinanceDemoState): string {
    // The default is from the already captured graph: never reread getState.
    return options.today ? options.today() : state.anchor;
  }

  function execute(input: PaymentInput, binding: DuplicateBinding | null, operationGeneration: number): PaymentRegistrationResult {
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    const supplied = options.getState();
    // A trusted dependency may synchronously cancel/reset and enqueue new work.
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    const state = getValidatedGymFinanceDemoState(supplied);
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    if (!state || !authorizedActor || !actorMatchesOwnedFinanceState(authorizedActor, state)) return failure(INVALID_STATE);

    // Use the exact trusted clock in a reducer probe so invalid form DTOs and
    // date semantics never consume IDs or accidentally reinterpret `today`.
    const today = resolveToday(state);
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    // Read once per execution and reuse for the probe and the real commit, so a
    // link change mid-execution cannot make the two calls disagree with each other.
    const gymTeacherStudentLinks = options.getGymTeacherStudentLinks?.();
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    const probeIds = freshProbeIds(state);
    const finalProbe = registerFinancePayment(state, command(input, actorToken, probeIds), today, gymTeacherStudentLinks);
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    if (!finalProbe.result.success && !("requiresConfirmation" in finalProbe.result)) return finalProbe.result;

    let ids: PaymentIds | null = binding;
    if (!ids) {
      const paymentId = allocateId(state, "payment", source, reservedIds);
      // Reserve an issued value before observing reentrant cancellation.
      if (paymentId) reservedIds.add(paymentId);
      if (!isCurrent(operationGeneration)) return failure(CANCELLED);
      if (!paymentId) return failure(ID_FAILURE);
      const commandId = allocateId(state, "command", source, reservedIds);
      if (commandId) reservedIds.add(commandId);
      if (!isCurrent(operationGeneration)) return failure(CANCELLED);
      if (!commandId) return failure(ID_FAILURE);
      ids = { paymentId, commandId };
    }
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    if (!ids) return failure(ID_FAILURE);

    const transition = registerFinancePayment(state, command(input, actorToken, ids), today, gymTeacherStudentLinks);
    // Never let an obsolete execution recreate dialog/replay state or commit.
    if (!isCurrent(operationGeneration)) return failure(CANCELLED);
    if ("requiresConfirmation" in transition.result) {
      // Only an exact request and its allocated pair can satisfy this prompt.
      pendingDuplicate = { signature: requestSignature(authorizedActor.id, input), ...ids };
      replayBinding = null;
      return transition.result;
    }
    if (!transition.result.success) {
      if (input.confirmedDuplicate === true) replayBinding = null;
      pendingDuplicate = null;
      return transition.result;
    }
    pendingDuplicate = null;
    replayBinding = input.confirmedDuplicate === true
      ? { signature: requestSignature(authorizedActor.id, input), ...ids }
      : null;
    if (!transition.result.idempotent) {
      if (!isCurrent(operationGeneration)) return failure(CANCELLED);
      // A commit callback can itself reset the provider; its already-applied
      // write cannot be rolled back, so the successful result remains honest.
      options.commit(transition.state);
    }
    return transition.result;
  }

  const callback: GymFinancePaymentCallback = (studentId, amountInput, nextPaymentDate, registrationOptions) => {
    // Authorization precedes every input getter, state/clock/ID dependency, and queue slot inspection.
    if (!authorizedActor) return Promise.resolve(failure(NO_AUTHORIZATION));
    const input = toInput(studentId, amountInput, nextPaymentDate, registrationOptions);
    if (!input) return Promise.resolve(failure("El pago no es válido."));
    const signature = requestSignature(authorizedActor.id, input);
    const confirming = input.confirmedDuplicate === true;
    const operationSignature = `${signature}|confirmed:${confirming ? "1" : "0"}`;

    if (!confirming) clearDuplicateBindings();
    let binding: DuplicateBinding | null = null;
    if (confirming) {
      const candidate = pendingDuplicate?.signature === signature ? pendingDuplicate
        : replayBinding?.signature === signature ? replayBinding
          : null;
      if (!candidate) return Promise.resolve(failure(INVALID_CONFIRMATION));
      binding = candidate;
    }

    if (pending) {
      return pending.signature === operationSignature && pending.generation === generation
        ? pending.promise
        : Promise.resolve(failure(BUSY));
    }

    const operationGeneration = generation;
    const entry = {} as PendingPayment;
    const promise = Promise.resolve().then(() => execute(input, binding, operationGeneration));
    entry.signature = operationSignature;
    entry.generation = operationGeneration;
    entry.promise = promise;
    pending = entry;
    void promise.then(
      () => { if (pending === entry) pending = null; },
      () => { if (pending === entry) pending = null; },
    );
    return promise;
  };

  callback.cancelPending = cancelCurrentWork;
  callback.cancelPendingDuplicate = cancelCurrentWork;
  return callback;
}
