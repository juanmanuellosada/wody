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
import type { CatalogSaleActor } from "./catalog-sales-contract";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveCatalogSaleActor } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteFinanceExpense, registerFinanceExpense, updateFinanceExpense } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isPlainDemoRevenueRecord } from "./revenue-demo-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteDemoPayment, deleteDemoSale, updateDemoPayment, updateDemoSale } from "./revenue-demo-state.ts";
import type { FinanceDemoState } from "./finance-demo-types";

type ExpenseLocalIdKind = "expense";
type MutationResult = ExpenseRegistrationResult | HistoryMutationResult;
type PendingMutation = { signature: string; promise: Promise<MutationResult> };
type CallbackPermission = "expense" | "history";

export type DemoRevenueCallbacks = {
  registerExpense: ExpenseRegistrationCallback;
  updateExpense: UpdateExpenseCallback;
  deleteExpense: DeleteExpenseCallback;
  updatePayment: UpdatePaymentCallback;
  deletePayment: DeletePaymentCallback;
  updateSale: UpdateSaleCallback;
  deleteSale: DeleteSaleCallback;
  /** Cancels only queued local work before a provider reset replaces the graph. */
  cancelPendingMutation: () => void;
};

export type DemoRevenueCallbackFactoryOptions = {
  getState: () => FinanceDemoState;
  commit: (state: FinanceDemoState) => void;
  /** Fixed by the provider; view callers never supply an actor. */
  fixedActor: unknown;
  /** Fresh Argentina-local date policy shared with sale and expense presentation. */
  trustedDatePolicy: ExpenseDatePolicy;
  /** Test-only deterministic expense ID injection. */
  nextId?: (kind: ExpenseLocalIdKind, state: FinanceDemoState) => string;
};

function failure(error: string): { success: false; error: string } {
  return { success: false, error };
}

function own(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

/**
 * Resolves a closed roster actor before any state read. Plain-record validation
 * and roster lookup can both trigger hostile proxy traps, so failures deny.
 */
function authorizedActor(value: unknown, permission: CallbackPermission): CatalogSaleActor | null {
  try {
    if (!isPlainDemoRevenueRecord(value)) return null;
    const actor = resolveCatalogSaleActor(value);
    if (!actor || actor.role !== "ADMIN") return null;
    return permission === "expense" && !actor.canViewRevenue ? null : actor;
  } catch {
    return null;
  }
}

/** Accept exact view-currency decimals; never round a non-cent amount into a valid cent value. */
function centsFromViewAmount(value: unknown, allowZero: boolean): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < (allowZero ? 0 : Number.MIN_VALUE) || value > FINANCE_CENTS_MAX / 100) return null;
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents < (allowZero ? 0 : 1) || cents > FINANCE_CENTS_MAX) return null;
  return cents / 100 === value ? cents : null;
}

function persistedIds(state: FinanceDemoState): Set<string> {
  return new Set([
    ...state.categories.map((category) => category.id),
    ...state.products.map((product) => product.id),
    ...state.payments.flatMap((payment) => [payment.id, payment.commandId]),
    ...state.sales.flatMap((sale) => [sale.id, sale.commandId]),
    ...state.expenses.map((expense) => expense.id),
  ]);
}

/** Counter allocation never derives a suffix from restored data; it only collision-checks it. */
function createDefaultExpenseIdAllocator(): (kind: ExpenseLocalIdKind, state: FinanceDemoState) => string {
  let next = 1;
  const reserved = new Set<string>();
  return (_kind, state) => {
    const persisted = persistedIds(state);
    while (next <= Number.MAX_SAFE_INTEGER) {
      const candidate = `finance-expense-local-${next}`;
      next += 1;
      if (!persisted.has(candidate) && !reserved.has(candidate)) {
        reserved.add(candidate);
        return candidate;
      }
    }
    throw new Error("No se pudo asignar un identificador local de gasto.");
  };
}

function expenseId(
  nextId: (kind: ExpenseLocalIdKind, state: FinanceDemoState) => string,
  state: FinanceDemoState,
  reserved: Set<string>,
): string | null {
  try {
    const id = nextId("expense", state);
    if (typeof id !== "string" || !id.trim() || persistedIds(state).has(id) || reserved.has(id)) return null;
    reserved.add(id);
    return id;
  } catch {
    return null;
  }
}

function historyResult(result: { success: boolean; error?: string }): HistoryMutationResult {
  return result.success ? { success: true } : failure(result.error ?? "No se pudo actualizar el historial.");
}

/**
 * Bridges only the seven local-history callbacks. Authorization runs before
 * signature work, state reads, and allocations; cores receive the canonical
 * frozen roster actor rather than the caller-provided object.
 */
export function createDemoRevenueCallbackFactory(options: DemoRevenueCallbackFactoryOptions): DemoRevenueCallbacks {
  const nextId = options.nextId ?? createDefaultExpenseIdAllocator();
  const reservedExpenseIds = new Set<string>();
  let pending: PendingMutation | null = null;
  let generation = 0;

  function schedule<T extends MutationResult>(signature: string, operation: () => T): Promise<T> {
    if (pending) {
      return pending.signature === signature
        ? pending.promise as Promise<T>
        : Promise.resolve(failure("Hay una operación financiera en curso. Esperá un momento.") as T);
    }
    const operationGeneration = generation;
    const promise = Promise.resolve().then(() => {
      if (operationGeneration !== generation) return failure("La operación financiera fue restablecida antes de guardarse.") as T;
      return operation();
    }).finally(() => {
      if (pending?.promise === promise) pending = null;
    });
    pending = { signature, promise };
    return promise;
  }

  function authorizedSchedule<T extends MutationResult>(
    permission: CallbackPermission,
    signature: () => string,
    operation: (actor: CatalogSaleActor) => T,
  ): Promise<T> {
    if (!authorizedActor(options.fixedActor, permission)) return Promise.resolve(failure("No autorizado.") as T);
    return schedule(signature(), () => {
      const actor = authorizedActor(options.fixedActor, permission);
      if (!actor) return failure("No autorizado.") as T;
      return operation(actor);
    });
  }

  const registerExpense: ExpenseRegistrationCallback = (amount, description, registrationOptions = {}) => authorizedSchedule(
    "expense",
    () => JSON.stringify(["registerExpense", amount, description, registrationOptions.spentAtStr]),
    (actor) => {
      const state = options.getState();
      if (!isValidFinanceDemoState(state)) return failure("El estado financiero no es válido.");
      if (!record(registrationOptions) || !hasOnly(registrationOptions, ["spentAtStr"])) return failure("El gasto no es válido.");
      const amountCents = centsFromViewAmount(amount, false);
      if (amountCents === null) return failure("El importe del gasto debe ser mayor a cero.");
      const id = expenseId(nextId, state, reservedExpenseIds);
      if (!id) return failure("No se pudo asignar un identificador local de gasto.");
      const transition = registerFinanceExpense(state, {
        id,
        actor,
        amountCents,
        description,
        spentAt: registrationOptions.spentAtStr ?? options.trustedDatePolicy.today(),
      }, options.trustedDatePolicy.today());
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true };
    },
  );

  const updateExpense: UpdateExpenseCallback = (id, data) => authorizedSchedule(
    "expense",
    () => JSON.stringify(["updateExpense", id, data]),
    (actor) => {
      const state = options.getState();
      if (!isValidFinanceDemoState(state)) return failure("El estado financiero no es válido.");
      if (!record(data) || !hasOnly(data, ["amount", "description"])) return failure("El gasto no es válido.");
      const command: Record<string, unknown> = { actor, expenseId: id };
      if (own(data, "amount")) {
        const amountCents = centsFromViewAmount(data.amount, false);
        if (amountCents === null) return failure("El importe del gasto debe ser mayor a cero.");
        command.amountCents = amountCents;
      }
      if (own(data, "description")) command.description = data.description;
      const transition = updateFinanceExpense(state, command);
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true };
    },
  );

  const deleteExpense: DeleteExpenseCallback = (id) => authorizedSchedule(
    "expense",
    () => JSON.stringify(["deleteExpense", id]),
    (actor) => {
      const state = options.getState();
      if (!isValidFinanceDemoState(state)) return failure("El estado financiero no es válido.");
      const transition = deleteFinanceExpense(state, { actor, expenseId: id });
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true };
    },
  );

  const updatePayment: UpdatePaymentCallback = (id, amount) => authorizedSchedule(
    "history",
    () => JSON.stringify(["updatePayment", id, amount]),
    (actor) => {
      const state = options.getState();
      const amountCents = centsFromViewAmount(amount, false);
      if (amountCents === null) return failure("El importe debe ser mayor a cero.");
      return historyResultWithCommit(updateDemoPayment(state, { actor, paymentId: id, amountCents }), options.commit);
    },
  );

  const deletePayment: DeletePaymentCallback = (id) => authorizedSchedule(
    "history",
    () => JSON.stringify(["deletePayment", id]),
    (actor) => historyResultWithCommit(deleteDemoPayment(options.getState(), { actor, paymentId: id }), options.commit),
  );

  const updateSale: UpdateSaleCallback = (id, data) => authorizedSchedule(
    "history",
    () => JSON.stringify(["updateSale", id, data]),
    (actor) => {
      if (!record(data) || !hasOnly(data, ["quantity", "unitAmount"])) return failure("La venta no es válida.");
      const command: Record<string, unknown> = { actor, saleId: id };
      if (own(data, "quantity")) command.quantity = data.quantity;
      if (own(data, "unitAmount")) {
        const unitAmountCents = centsFromViewAmount(data.unitAmount, true);
        if (unitAmountCents === null) return failure("El importe unitario debe ser mayor o igual a cero.");
        command.unitAmountCents = unitAmountCents;
      }
      return historyResultWithCommit(updateDemoSale(options.getState(), command), options.commit);
    },
  );

  const deleteSale: DeleteSaleCallback = (id) => authorizedSchedule(
    "history",
    () => JSON.stringify(["deleteSale", id]),
    (actor) => historyResultWithCommit(deleteDemoSale(options.getState(), { actor, saleId: id }), options.commit),
  );

  return {
    registerExpense,
    updateExpense,
    deleteExpense,
    updatePayment,
    deletePayment,
    updateSale,
    deleteSale,
    cancelPendingMutation: () => {
      generation += 1;
      pending = null;
    },
  };
}

function historyResultWithCommit(
  transition: { state: FinanceDemoState; result: { success: boolean; error?: string } },
  commit: (state: FinanceDemoState) => void,
): HistoryMutationResult {
  if (!transition.result.success) return historyResult(transition.result);
  commit(transition.state);
  return { success: true };
}
