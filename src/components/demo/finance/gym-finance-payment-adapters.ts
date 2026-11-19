import type {
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
};

/**
 * The dialog keeps this shape (an optional 5th argument is still assignable everywhere a plain
 * 4-arg PaymentRegistrationCallback is expected) while the future GYM provider owns reset/unmount
 * wiring.
 *
 * `gymTeacherStudentLinks` is a plain call-time argument, not a stored/injected accessor: the
 * caller (DemoGymFeesAdapter, which reads profileState.links fresh every render, the same way it
 * feeds bridgeLinks into the Cuotas scoping projection) passes the CURRENT bridge link set with
 * each dispatch. This factory is created once at hydration and its internal pending/duplicate/ID
 * state must persist across renders, so it cannot simply close over profileState.links directly —
 * but nothing about that requires caching the links themselves in a ref between calls. Each call
 * carries its own snapshot end to end (captured synchronously in `callback`, before the deferred
 * `execute()` even runs), so there is no shared mutable link state for one call's data to leak
 * into, or "rewind" for another to accidentally reuse. Omitted, the reducer falls back to the
 * canonical directory link set, exactly as before this parameter existed.
 */
export type GymFinancePaymentCallback = ((
  studentId: string,
  amountInput: string,
  nextPaymentDate: string,
  options: PaymentRegistrationOptions,
  gymTeacherStudentLinks?: readonly GymFinanceTeacherStudentLink[],
) => Promise<PaymentRegistrationResult>) & {
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

/**
 * Folds gymTeacherStudentLinks into the pending/busy dedupe key (see operationSignature below),
 * never into requestSignature: the duplicate-confirmation binding it feeds always gets
 * re-authorized against the CONFIRMING call's own current links inside execute(), so a stale
 * binding cannot itself authorize anything — only the pending/busy path can, by returning an
 * EARLIER call's already-settled promise for a LATER call without ever re-running execute() for
 * it. Without this, two same-signature calls that differ only in links would collide on the same
 * operationSignature, and the second one would silently resolve to the first one's result computed
 * against the first one's links — a wrongful allow if the first call's links were more permissive
 * than the second's. Reading link contents defensively (never throwing here) matters because this
 * runs synchronously inside `callback`, before any deferred boundary: an unvalidated shape (the
 * same "not-an-array" case covered in gym-finance-payment-adapters.test.mjs) must still surface as
 * an async rejection from execute()/registerFinancePayment, not a synchronous throw out of
 * `callback` itself — the try/catch below is what guarantees that, uniformly for every non-array
 * shape, so there is no separate typeof/Array.isArray branch to keep in sync with it.
 *
 * Deliberately ORDER-SENSITIVE: the same links in a different order produce a different signature.
 * That is the conservative direction for an authorization key — it can only cost an occasional
 * extra BUSY rejection, never coalesce two calls whose authorization actually differs.
 */
function linksPart(links: unknown): string {
  try {
    if (links === undefined) return "links:undefined";
    const list = links as readonly GymFinanceTeacherStudentLink[];
    return `links:${list.length}:${list.map((link) => {
      const record = link && typeof link === "object" ? (link as Record<string, unknown>) : null;
      return `${valuePart(record?.teacherId)}~${valuePart(record?.studentId)}`;
    }).join(",")}`;
  } catch {
    return "links:opaque";
  }
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

  function execute(
    input: PaymentInput,
    binding: DuplicateBinding | null,
    operationGeneration: number,
    gymTeacherStudentLinks: readonly GymFinanceTeacherStudentLink[] | undefined,
  ): PaymentRegistrationResult {
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
    // gymTeacherStudentLinks is already this call's own fixed snapshot (a plain parameter, passed
    // through unchanged from `callback`), so the probe and the real commit below agree with each
    // other by construction — nothing re-reads a mutable source in between.
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

  const callback: GymFinancePaymentCallback = (studentId, amountInput, nextPaymentDate, registrationOptions, gymTeacherStudentLinks) => {
    // Authorization precedes every input getter, state/clock/ID dependency, and queue slot inspection.
    if (!authorizedActor) return Promise.resolve(failure(NO_AUTHORIZATION));
    const input = toInput(studentId, amountInput, nextPaymentDate, registrationOptions);
    if (!input) return Promise.resolve(failure("El pago no es válido."));
    const signature = requestSignature(authorizedActor.id, input);
    const confirming = input.confirmedDuplicate === true;
    // Links are part of THIS call's authorization, not just its input shape: two calls that agree
    // on every other field but disagree on links must never coalesce onto the same pending slot
    // (see linksPart's doc comment for the wrongful-allow this closes).
    const operationSignature = `${signature}|confirmed:${confirming ? "1" : "0"}|${linksPart(gymTeacherStudentLinks)}`;

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
    const promise = Promise.resolve().then(() => execute(input, binding, operationGeneration, gymTeacherStudentLinks));
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
