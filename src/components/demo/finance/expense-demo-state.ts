// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX, canManageExpenses, isKnownExpenseRecorder, type ExpenseDemoResult, type ExpenseDemoTransition } from "./expense-demo-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isFinanceDate } from "./finance-demo-state.ts";
import type { FinanceDemoState, FinanceExpense } from "./finance-demo-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) return false;
  }
  return true;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExpenseAmount(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= FINANCE_CENTS_MAX;
}

function result(state: FinanceDemoState, value: ExpenseDemoResult): ExpenseDemoTransition<FinanceDemoState> {
  return { state, result: value };
}

function failure(state: FinanceDemoState, error: string): ExpenseDemoTransition<FinanceDemoState> {
  return result(state, { success: false, error });
}

/** The stored expense collection is closed, dense, and tied to the designated-admin roster. */
export function isValidFinanceExpenseGraph(value: unknown): value is FinanceExpense[] {
  if (!isDenseArray(value)) return false;
  const ids = new Set<string>();
  for (const expense of value) {
    if (!isRecord(expense)
      || !hasOnlyKeys(expense, ["id", "amountCents", "description", "spentAt", "recordedById"])
      || !isId(expense.id)
      || !isExpenseAmount(expense.amountCents)
      || typeof expense.description !== "string"
      || expense.description !== expense.description.trim()
      || !expense.description
      || !isFinanceDate(expense.spentAt)
      || !isKnownExpenseRecorder(expense.recordedById)) return false;
    if (ids.has(expense.id)) return false;
    ids.add(expense.id);
  }
  return true;
}

function hasUsableExpenseState(state: unknown): state is FinanceDemoState {
  return isRecord(state) && isValidFinanceExpenseGraph(state.expenses);
}

function validToday(today: unknown): today is string {
  return isFinanceDate(today);
}

function validateActor(rawCommand: Record<string, unknown>): string | null {
  const actor = canManageExpenses(rawCommand.actor) ? rawCommand.actor : null;
  if (!actor) return null;
  return typeof actor === "object" && actor !== null && "id" in actor && typeof actor.id === "string" ? actor.id : null;
}

/** Creates a local expense with the same positive-amount, trimmed-description, and no-future-date contract as expense.ts. */
export function registerFinanceExpense(
  state: FinanceDemoState,
  rawCommand: unknown,
  today: string = state?.anchor,
): ExpenseDemoTransition<FinanceDemoState> {
  if (!hasUsableExpenseState(state)) return failure(state, "Los gastos no son válidos.");
  if (!isRecord(rawCommand)
    || !hasOnlyKeys(rawCommand, ["id", "actor", "amountCents", "description", "spentAt"])
    || !hasOwn(rawCommand, "id")
    || !hasOwn(rawCommand, "actor")
    || !hasOwn(rawCommand, "amountCents")
    || !hasOwn(rawCommand, "description")
    || !hasOwn(rawCommand, "spentAt")) return failure(state, "El gasto no es válido.");
  const actorId = validateActor(rawCommand);
  if (!actorId) return failure(state, "No autorizado.");
  if (!isId(rawCommand.id) || !isExpenseAmount(rawCommand.amountCents)) return failure(state, "El importe del gasto debe ser mayor a cero.");
  if (typeof rawCommand.description !== "string" || !rawCommand.description.trim()) return failure(state, "La descripción es obligatoria.");
  if (!isFinanceDate(rawCommand.spentAt) || !validToday(today)) return failure(state, "La fecha del gasto no es válida.");
  if (rawCommand.spentAt > today) return failure(state, "La fecha del gasto no puede ser futura.");
  if (state.expenses.some((expense) => expense.id === rawCommand.id)) return failure(state, "Identificador de gasto inválido.");

  const expense: FinanceExpense = {
    id: rawCommand.id,
    amountCents: rawCommand.amountCents,
    description: rawCommand.description.trim(),
    spentAt: rawCommand.spentAt,
    recordedById: actorId,
  };
  return result({ ...state, expenses: [...state.expenses, expense] }, { success: true, id: expense.id });
}

/** The live action only permits amount and description changes; recorder and spent date are immutable in the demo too. */
export function updateFinanceExpense(state: FinanceDemoState, rawCommand: unknown): ExpenseDemoTransition<FinanceDemoState> {
  if (!hasUsableExpenseState(state)) return failure(state, "Los gastos no son válidos.");
  if (!isRecord(rawCommand)
    || !hasOnlyKeys(rawCommand, ["actor", "expenseId", "amountCents", "description"])
    || !hasOwn(rawCommand, "actor")
    || !hasOwn(rawCommand, "expenseId")) return failure(state, "El gasto no es válido.");
  if (!validateActor(rawCommand)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.expenseId)) return failure(state, "Gasto no encontrado.");
  const expense = state.expenses.find((candidate) => candidate.id === rawCommand.expenseId);
  if (!expense) return failure(state, "Gasto no encontrado.");

  const changes: Partial<Pick<FinanceExpense, "amountCents" | "description">> = {};
  if (hasOwn(rawCommand, "amountCents")) {
    if (!isExpenseAmount(rawCommand.amountCents)) return failure(state, "El importe del gasto debe ser mayor a cero.");
    changes.amountCents = rawCommand.amountCents;
  }
  if (hasOwn(rawCommand, "description")) {
    if (typeof rawCommand.description !== "string" || !rawCommand.description.trim()) return failure(state, "La descripción no puede estar vacía.");
    changes.description = rawCommand.description.trim();
  }
  if (Object.keys(changes).length === 0) return failure(state, "No hay cambios para guardar.");

  return result({
    ...state,
    expenses: state.expenses.map((candidate) => candidate.id === expense.id ? { ...candidate, ...changes } : candidate),
  }, { success: true, id: expense.id });
}

export function deleteFinanceExpense(state: FinanceDemoState, rawCommand: unknown): ExpenseDemoTransition<FinanceDemoState> {
  if (!hasUsableExpenseState(state)) return failure(state, "Los gastos no son válidos.");
  if (!isRecord(rawCommand)
    || !hasOnlyKeys(rawCommand, ["actor", "expenseId"])
    || !hasOwn(rawCommand, "actor")
    || !hasOwn(rawCommand, "expenseId")) return failure(state, "El gasto no es válido.");
  if (!validateActor(rawCommand)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.expenseId) || !state.expenses.some((expense) => expense.id === rawCommand.expenseId)) return failure(state, "Gasto no encontrado.");
  return result({ ...state, expenses: state.expenses.filter((expense) => expense.id !== rawCommand.expenseId) }, { success: true, id: rawCommand.expenseId });
}
