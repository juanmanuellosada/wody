import type {
  PaymentRegistrationCallback,
  PaymentRegistrationOptions,
  PaymentRegistrationResult,
  PaymentStudent,
} from "@/components/payments/RegisterPaymentDialogView";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { demoFeeIdentities } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { registerFinancePayment, suggestNextFinancePaymentDate } from "./finance-demo-state.ts";
import type {
  FinanceDemoState,
  FinancePaymentCommand,
  FinancePaymentMethod,
  FinancePaymentResult,
} from "./finance-demo-types";

export type FinancePaymentCallbackFactoryOptions = {
  getState: () => FinanceDemoState;
  commit: (state: FinanceDemoState) => void;
  actor: unknown;
  today?: () => string;
  nextId?: (kind: "payment" | "command", state: FinanceDemoState) => string;
};

type DuplicateBinding = { signature: string; commandId: string; paymentId: string };

/**
 * A confirmation is valid only for the exact duplicate prompt that created it.
 * `cancelPendingDuplicate` lets the later provider clear that binding when its
 * dialog cancellation callback is wired; ordinary unconfirmed submissions also
 * clear it before they can create a replacement prompt.
 */
export type FinancePaymentCallback = PaymentRegistrationCallback & {
  cancelPendingDuplicate: () => void;
};

type FinanceLocalIdKind = "payment" | "command";

/**
 * Default identifiers are reserved for this factory's whole lifetime. We never
 * infer a counter from persisted suffixes, so an untrusted large suffix cannot
 * alter arithmetic; persisted IDs are only collision checks for fresh attempts.
 */
function createDefaultIdAllocator(): (kind: FinanceLocalIdKind, state: FinanceDemoState) => string {
  const nextSuffix: Record<FinanceLocalIdKind, number> = { payment: 1, command: 1 };
  const reserved: Record<FinanceLocalIdKind, Set<string>> = { payment: new Set(), command: new Set() };

  return (kind, state) => {
    const persisted = new Set(kind === "payment"
      ? state.payments.map((payment) => payment.id)
      : state.payments.map((payment) => payment.commandId));
    while (nextSuffix[kind] <= Number.MAX_SAFE_INTEGER) {
      const candidate = `finance-${kind}-local-${nextSuffix[kind]}`;
      nextSuffix[kind] += 1;
      if (!persisted.has(candidate) && !reserved[kind].has(candidate)) {
        reserved[kind].add(candidate);
        return candidate;
      }
    }
    throw new Error("No se pudo asignar un identificador financiero local.");
  };
}

function paymentSignature(
  actor: unknown,
  studentId: string,
  amountInput: string,
  nextPaymentDate: string,
  options: PaymentRegistrationOptions,
): string {
  const actorIdentity = typeof actor === "object" && actor !== null && !Array.isArray(actor)
    ? [Reflect.get(actor, "id"), Reflect.get(actor, "role")]
    : [null, null];
  return JSON.stringify([actorIdentity, studentId, amountInput, nextPaymentDate, options.paidAtStr, options.paymentMethod]);
}

function toViewResult(result: FinancePaymentResult): PaymentRegistrationResult {
  return result.success || "requiresConfirmation" in result
    ? result
    : { success: false, error: result.error };
}

/** Builds dialog students from the latest local snapshot; amount conversion remains at the display boundary. */
export function projectFinancePaymentStudents(state: FinanceDemoState): PaymentStudent[] {
  return state.students
    .filter((student) => !student.deletedAt)
    .map((student) => {
      const lastPayment = [...state.payments]
        .filter((payment) => payment.studentId === student.id)
        .sort((left, right) => right.paidAt.localeCompare(left.paidAt))[0];
      return {
        id: student.id,
        name: student.name,
        suggestedNextDate: suggestNextFinancePaymentDate(student.nextPaymentDate),
        lastAmount: lastPayment ? lastPayment.amountCents / 100 : null,
        paymentExempt: student.paymentExempt,
        paymentExemptReason: student.paymentExemptReason,
      };
    });
}

/**
 * Adapts the extracted dialog callback to a fresh local-state transaction.
 * Command IDs are intentionally local implementation detail and never cross the production callback boundary.
 */
export function createFinancePaymentCallbackFactory(options: FinancePaymentCallbackFactoryOptions): FinancePaymentCallback {
  const nextId = options.nextId ?? createDefaultIdAllocator();
  const today = options.today ?? (() => options.getState().anchor);
  let pendingDuplicate: DuplicateBinding | null = null;
  let replayBinding: DuplicateBinding | null = null;

  const callback = async (
    studentId: string,
    amountInput: string,
    nextPaymentDate: string,
    registrationOptions: PaymentRegistrationOptions,
  ) => {
    const signature = paymentSignature(options.actor, studentId, amountInput, nextPaymentDate, registrationOptions);
    const isConfirmation = registrationOptions.confirmedDuplicate;
    const state = options.getState();
    if (isConfirmation && pendingDuplicate?.signature !== signature && replayBinding?.signature !== signature) {
      return { success: false as const, error: "La confirmación de pago ya no es válida." };
    }

    // A fresh form submission begins a new duplicate lifecycle and cannot reuse an old confirmation.
    if (!isConfirmation) {
      pendingDuplicate = null;
      replayBinding = null;
    }
    const binding = isConfirmation
      ? pendingDuplicate?.signature === signature ? pendingDuplicate : replayBinding!
      : { commandId: nextId("command", state), paymentId: nextId("payment", state), signature };
    const command: FinancePaymentCommand = {
      id: binding.paymentId,
      commandId: binding.commandId,
      actor: options.actor,
      studentId,
      amountInput,
      paidAt: registrationOptions.paidAtStr,
      nextPaymentDate,
      paymentMethod: registrationOptions.paymentMethod as FinancePaymentMethod,
      confirmedDuplicate: isConfirmation,
    };
    const transition = registerFinancePayment(state, command, today());
    if (transition.result.success) {
      pendingDuplicate = null;
      // Keep only the exact successful confirmation for a transport/re-render replay.
      replayBinding = isConfirmation ? binding : null;
      if (!transition.result.idempotent) options.commit(transition.state);
    } else if ("requiresConfirmation" in transition.result) {
      pendingDuplicate = binding;
      replayBinding = null;
    } else {
      pendingDuplicate = null;
      if (isConfirmation) replayBinding = null;
    }
    return toViewResult(transition.result);
  };
  callback.cancelPendingDuplicate = () => {
    pendingDuplicate = null;
    replayBinding = null;
  };
  return callback;
}

/** Fixture identities are exported as a narrow convenience for the later client-only provider. */
export const financeDemoActors = demoFeeIdentities;
