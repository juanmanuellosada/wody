import type { ExpenseDatePolicy, ExpenseRegistrationCallback, ExpenseRegistrationResult } from "@/components/expenses/expense-view-contracts";
import type {
  DeleteExpenseCallback,
  DeletePaymentCallback,
  DeleteSaleCallback,
  HistoryMutationResult,
  UpdateExpenseCallback,
  UpdatePaymentCallback,
  UpdateSaleCallback,
} from "@/components/finance/history-view-contracts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteFinanceExpense, registerFinanceExpense, updateFinanceExpense } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteDemoPayment, deleteDemoSale, updateDemoPayment, updateDemoSale } from "./revenue-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesOwnedFinanceState, canCorrectFinanceHistory, canManageFinanceExpenses, isGymFinanceActor, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type { GymFinanceDemoState } from "./finance-demo-types";

type GymExpenseIdKind = "expense";
type MutationResult = ExpenseRegistrationResult | HistoryMutationResult;
type PendingMutation = { signature: string; generation: number; promise: Promise<MutationResult> };
type Permission = "expense" | "history";
type CapturedFields = Readonly<{ values: Readonly<Record<string, unknown>>; keys: readonly string[]; validShape: boolean }>;

export type GymRevenueDemoCallbacks = {
  registerExpense: ExpenseRegistrationCallback;
  updateExpense: UpdateExpenseCallback;
  deleteExpense: DeleteExpenseCallback;
  updatePayment: UpdatePaymentCallback;
  deletePayment: DeletePaymentCallback;
  updateSale: UpdateSaleCallback;
  deleteSale: DeleteSaleCallback;
  /** Invalidates scheduled work before a future provider reset or unmount. */
  cancelPendingMutation: () => void;
  /** Compatibility alias for the provider-facing cancellation boundary. */
  cancelPending: () => void;
};

export type GymRevenueDemoCallbackFactoryOptions = {
  getState: () => GymFinanceDemoState;
  commit: (state: GymFinanceDemoState) => void;
  /** Opaque canonical directory token; roles or copied profiles never authorize this bridge. */
  boundGymActorToken: unknown;
  /** Trusted provider clock used when a queued expense command executes. */
  trustedExpenseDatePolicy: ExpenseDatePolicy;
  /** Test-only deterministic source; issued values remain factory-private reservations. */
  nextId?: (kind: GymExpenseIdKind, state: GymFinanceDemoState) => string;
};

const MAX_ID_ATTEMPTS = 64;
const NOT_AUTHORIZED = "No autorizado.";
const INVALID_STATE = "El estado financiero no es válido.";
const BUSY = "Hay una operación financiera en curso. Esperá un momento.";
const CANCELLED = "La operación financiera fue restablecida antes de guardarse.";
const ID_FAILURE = "No se pudo asignar un identificador local de gasto.";

function failure(error: string): { success: false; error: string } {
  return { success: false, error };
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Preserve BOX's exact display round-trip: never round a non-cent DTO into valid money. */
function centsFromViewAmount(value: unknown, allowZero: boolean): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < (allowZero ? 0 : Number.MIN_VALUE) || value > FINANCE_CENTS_MAX / 100) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && cents >= (allowZero ? 0 : 1) && cents / 100 === value ? cents : null;
}

function valuePart(value: unknown): string {
  if (typeof value === "string") return `s:${value.length}:${value}`;
  if (typeof value === "number") return Number.isFinite(value) ? `n:${value}` : "n:invalid";
  if (typeof value === "boolean") return value ? "b:1" : "b:0";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return `other:${typeof value}`;
}

function sameKeys(left: readonly (string | symbol)[], right: readonly (string | symbol)[]): boolean {
  return left.length === right.length && left.every((key) => right.includes(key));
}

/**
 * Capture source descriptors once. The second key enumeration is solely over
 * the private descriptor map, so neither getters nor toJSON can affect queued work.
 */
function captureFields(value: unknown, allowed: readonly string[], minimum: number): CapturedFields {
  const invalid: CapturedFields = { values: Object.freeze({}), keys: Object.freeze([]), validShape: false };
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return invalid;
    const sourceKeys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const descriptorKeys = Reflect.ownKeys(descriptors);
    if (!sameKeys(sourceKeys, descriptorKeys) || sourceKeys.some((key) => typeof key !== "string")) return invalid;
    const keys = sourceKeys as string[];
    if (keys.length < minimum || keys.length > allowed.length || keys.some((key) => !allowed.includes(key))) return invalid;
    if (!keys.every((key) => {
      const descriptor = descriptors[key];
      return descriptor && "value" in descriptor && descriptor.enumerable;
    })) return invalid;
    const values: Record<string, unknown> = {};
    for (const key of keys) values[key] = descriptors[key].value;
    return { values: Object.freeze(values), keys: Object.freeze([...keys]), validShape: true };
  } catch {
    return invalid;
  }
}

function fieldsSignature(fields: CapturedFields): string {
  return fields.keys.map((key) => `${key.length}:${key}=${valuePart(fields.values[key])}`).join(";");
}

function requestSignature(operation: string, actorId: string, values: readonly unknown[], fields?: CapturedFields): string {
  return [
    `operation:${operation}`,
    `actor:${actorId.length}:${actorId}`,
    ...values.map(valuePart),
    fields ? `fields:${fields.validShape ? "1" : "0"}:${fieldsSignature(fields)}` : "",
  ].join("|");
}

function occupiedIds(state: GymFinanceDemoState): Set<string> {
  return new Set([
    ...state.categories.map((entry) => entry.id),
    ...state.products.map((entry) => entry.id),
    ...state.payments.flatMap((entry) => [entry.id, entry.commandId]),
    ...state.sales.flatMap((entry) => [entry.id, entry.commandId]),
    ...state.expenses.map((entry) => entry.id),
  ]);
}

function createDefaultIdSource(): (kind: GymExpenseIdKind) => string {
  let suffix = 1;
  return () => `gym-finance-expense-local-${suffix++}`;
}

/** Attempts are bounded by source calls, and every accepted candidate is lifetime-reserved. */
function allocateExpenseId(
  state: GymFinanceDemoState,
  source: (kind: GymExpenseIdKind, state: GymFinanceDemoState) => string,
  reserved: Set<string>,
): string | null {
  const occupied = occupiedIds(state);
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    // Trusted source failures deliberately propagate; queue cleanup releases the pending slot.
    const candidate = source("expense", state);
    if (isId(candidate) && !occupied.has(candidate) && !reserved.has(candidate)) {
      reserved.add(candidate);
      return candidate;
    }
  }
  return null;
}

function historyResult(result: { success: boolean; error?: string }): HistoryMutationResult {
  return result.success ? { success: true } : failure(result.error ?? "No se pudo actualizar el historial.");
}

function authorizedActor(token: unknown, permission: Permission) {
  // Directory identity is checked before the generic finance resolver, preventing BOX fallback.
  const canonical = resolveGymDemoActor(token);
  if (!canonical || canonical.role !== "ADMIN") return null;
  const actor = resolveFinanceDemoActor(token);
  if (!actor || !isGymFinanceActor(actor)) return null;
  return permission === "expense"
    ? (canManageFinanceExpenses(actor) ? actor : null)
    : (canCorrectFinanceHistory(actor) ? actor : null);
}

/**
 * Unmounted GYM expense/history bridge. The core reducers own business errors,
 * partial-patch semantics, dates, archived history, and accounting snapshots.
 */
export function createGymRevenueDemoCallbackFactory(options: GymRevenueDemoCallbackFactoryOptions): GymRevenueDemoCallbacks {
  const actorToken = options.boundGymActorToken;
  const expenseActor = authorizedActor(actorToken, "expense");
  const historyActor = authorizedActor(actorToken, "history");
  const defaultId = createDefaultIdSource();
  const source = options.nextId ?? ((kind: GymExpenseIdKind) => defaultId(kind));
  const reservedIds = new Set<string>();
  let generation = 0;
  let pending: PendingMutation | null = null;

  function current(operationGeneration: number): boolean {
    return operationGeneration === generation;
  }

  function cancellation(): MutationResult {
    return failure(CANCELLED);
  }

  function freshState(operationGeneration: number, actor: NonNullable<typeof expenseActor>): GymFinanceDemoState | MutationResult {
    const supplied = options.getState();
    if (!current(operationGeneration)) return cancellation();
    const state = getValidatedGymFinanceDemoState(supplied);
    if (!current(operationGeneration)) return cancellation();
    if (!state || !actorMatchesOwnedFinanceState(actor, state)) return failure(INVALID_STATE);
    return state;
  }

  function isResult(value: GymFinanceDemoState | MutationResult): value is MutationResult {
    return "success" in value;
  }

  function schedule(
    permission: Permission,
    signature: string,
    execute: (actor: NonNullable<typeof expenseActor>, operationGeneration: number) => MutationResult,
  ): Promise<MutationResult> {
    const actor = permission === "expense" ? expenseActor : historyActor;
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    if (pending) return pending.signature === signature && pending.generation === generation ? pending.promise : Promise.resolve(failure(BUSY));

    const operationGeneration = generation;
    const entry = {} as PendingMutation;
    const promise = Promise.resolve().then(() => current(operationGeneration) ? execute(actor, operationGeneration) : cancellation());
    entry.signature = signature;
    entry.generation = operationGeneration;
    entry.promise = promise;
    pending = entry;
    void promise.then(
      () => { if (pending === entry) pending = null; },
      () => { if (pending === entry) pending = null; },
    );
    return promise;
  }

  const registerExpense: ExpenseRegistrationCallback = (amount, description, registrationOptions = {}) => {
    if (!expenseActor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const fields = captureFields(registrationOptions, ["spentAtStr"], 0);
    if (!fields.validShape) return Promise.resolve(failure("El gasto no es válido."));
    const signature = requestSignature("registerExpense", expenseActor.id, [amount, description], fields);
    return schedule("expense", signature, (actor, operationGeneration) => {
      const state = freshState(operationGeneration, actor);
      if (isResult(state)) return state;
      const amountCents = centsFromViewAmount(amount, false);
      if (amountCents === null) return failure("El importe del gasto debe ser mayor a cero.");
      const today = options.trustedExpenseDatePolicy.today();
      if (!current(operationGeneration)) return cancellation();
      const id = allocateExpenseId(state, source, reservedIds);
      if (!current(operationGeneration)) return cancellation();
      if (!id) return failure(ID_FAILURE);
      const transition = registerFinanceExpense(state, {
        id,
        actor: actorToken,
        amountCents,
        description,
        spentAt: fields.keys.includes("spentAtStr") ? fields.values.spentAtStr : today,
      }, today);
      if (!current(operationGeneration)) return cancellation();
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true };
    });
  };

  const updateExpense: UpdateExpenseCallback = (expenseId, data) => {
    if (!expenseActor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const fields = captureFields(data, ["amount", "description"], 0);
    if (!fields.validShape) return Promise.resolve(failure("El gasto no es válido."));
    const signature = requestSignature("updateExpense", expenseActor.id, [expenseId], fields);
    return schedule("expense", signature, (actor, operationGeneration) => {
      const state = freshState(operationGeneration, actor);
      if (isResult(state)) return state;
      const command: Record<string, unknown> = { actor: actorToken, expenseId };
      if (fields.keys.includes("amount")) {
        const amountCents = centsFromViewAmount(fields.values.amount, false);
        if (amountCents === null) return failure("El importe del gasto debe ser mayor a cero.");
        command.amountCents = amountCents;
      }
      if (fields.keys.includes("description")) command.description = fields.values.description;
      const transition = updateFinanceExpense(state, command);
      if (!current(operationGeneration)) return cancellation();
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true };
    });
  };

  const deleteExpense: DeleteExpenseCallback = (expenseId) => schedule(
    "expense",
    requestSignature("deleteExpense", expenseActor?.id ?? "", [expenseId]),
    (actor, operationGeneration) => {
      const state = freshState(operationGeneration, actor);
      if (isResult(state)) return state;
      const transition = deleteFinanceExpense(state, { actor: actorToken, expenseId });
      if (!current(operationGeneration)) return cancellation();
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true };
    },
  );

  const updatePayment: UpdatePaymentCallback = (paymentId, amount) => schedule(
    "history",
    requestSignature("updatePayment", historyActor?.id ?? "", [paymentId, amount]),
    (actor, operationGeneration) => {
      const state = freshState(operationGeneration, actor);
      if (isResult(state)) return state;
      const amountCents = centsFromViewAmount(amount, false);
      if (amountCents === null) return failure("El importe debe ser mayor a cero.");
      const transition = updateDemoPayment(state, { actor: actorToken, paymentId, amountCents });
      if (!current(operationGeneration)) return cancellation();
      if (!transition.result.success) return historyResult(transition.result);
      options.commit(transition.state);
      return { success: true };
    },
  );

  const deletePayment: DeletePaymentCallback = (paymentId) => schedule(
    "history",
    requestSignature("deletePayment", historyActor?.id ?? "", [paymentId]),
    (actor, operationGeneration) => {
      const state = freshState(operationGeneration, actor);
      if (isResult(state)) return state;
      const transition = deleteDemoPayment(state, { actor: actorToken, paymentId });
      if (!current(operationGeneration)) return cancellation();
      if (!transition.result.success) return historyResult(transition.result);
      options.commit(transition.state);
      return { success: true };
    },
  );

  const updateSale: UpdateSaleCallback = (saleId, data) => {
    if (!historyActor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const fields = captureFields(data, ["quantity", "unitAmount"], 0);
    if (!fields.validShape) return Promise.resolve(failure("La venta no es válida."));
    const signature = requestSignature("updateSale", historyActor.id, [saleId], fields);
    return schedule("history", signature, (actor, operationGeneration) => {
      const state = freshState(operationGeneration, actor);
      if (isResult(state)) return state;
      const command: Record<string, unknown> = { actor: actorToken, saleId };
      if (fields.keys.includes("quantity")) command.quantity = fields.values.quantity;
      if (fields.keys.includes("unitAmount")) {
        const unitAmountCents = centsFromViewAmount(fields.values.unitAmount, true);
        if (unitAmountCents === null) return failure("El importe unitario debe ser mayor o igual a cero.");
        command.unitAmountCents = unitAmountCents;
      }
      const transition = updateDemoSale(state, command);
      if (!current(operationGeneration)) return cancellation();
      if (!transition.result.success) return historyResult(transition.result);
      options.commit(transition.state);
      return { success: true };
    });
  };

  const deleteSale: DeleteSaleCallback = (saleId) => schedule(
    "history",
    requestSignature("deleteSale", historyActor?.id ?? "", [saleId]),
    (actor, operationGeneration) => {
      const state = freshState(operationGeneration, actor);
      if (isResult(state)) return state;
      const transition = deleteDemoSale(state, { actor: actorToken, saleId });
      if (!current(operationGeneration)) return cancellation();
      if (!transition.result.success) return historyResult(transition.result);
      options.commit(transition.state);
      return { success: true };
    },
  );

  function cancelPendingMutation() {
    generation += 1;
    pending = null;
  }

  return {
    registerExpense,
    updateExpense,
    deleteExpense,
    updatePayment,
    deletePayment,
    updateSale,
    deleteSale,
    cancelPendingMutation,
    cancelPending: cancelPendingMutation,
  };
}

/** Explicit finance namespace alias for consumers that use the payment factory naming convention. */
export const createGymFinanceRevenueCallbackFactory = createGymRevenueDemoCallbackFactory;
