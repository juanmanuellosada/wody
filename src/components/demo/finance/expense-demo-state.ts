// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX, isKnownExpenseRecorder, type ExpenseDemoResult, type ExpenseDemoTransition } from "./expense-demo-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesFinanceState, actorMatchesOwnedFinanceState, canManageFinanceExpenses, isGymFinanceActor, isKnownFinanceRecorder, resolveFinanceCommandActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isFinanceDate } from "./finance-demo-state.ts";
import type { KnownFinanceDemoState, FinanceExpense } from "./finance-demo-types";

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean { return Object.keys(value).every((key) => allowedKeys.includes(key)); }
function hasOwn(value: Record<string, unknown>, key: string): boolean { return Object.prototype.hasOwnProperty.call(value, key); }
function isDenseArray(value: unknown): value is unknown[] { if (!Array.isArray(value)) return false; for (let index = 0; index < value.length; index += 1) if (!(index in value)) return false; return true; }
function isId(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function isExpenseAmount(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= FINANCE_CENTS_MAX; }

const originalGymInputs = new WeakMap<object, KnownFinanceDemoState>();
function result<T extends KnownFinanceDemoState>(state: T, value: ExpenseDemoResult): ExpenseDemoTransition<T> { return { state, result: value }; }
function failure<T extends KnownFinanceDemoState>(state: T, error: string): ExpenseDemoTransition<T> {
  const original = typeof state === "object" && state !== null ? originalGymInputs.get(state) : undefined;
  return result((original ?? state) as T, { success: false, error });
}

/** The stored expense collection is closed, dense, and tied to the designated-admin roster. */
export function isValidFinanceExpenseGraph(value: unknown, state?: KnownFinanceDemoState): value is FinanceExpense[] {
  if (!isDenseArray(value)) return false;
  const ids = new Set<string>();
  for (const expense of value) {
    if (!isRecord(expense) || !hasOnlyKeys(expense, ["id", "amountCents", "description", "spentAt", "recordedById"])
      || !isId(expense.id) || !isExpenseAmount(expense.amountCents) || typeof expense.description !== "string"
      || expense.description !== expense.description.trim() || !expense.description || !isFinanceDate(expense.spentAt)
      || !(state ? isKnownFinanceRecorder(state, expense.recordedById) : isKnownExpenseRecorder(expense.recordedById))) return false;
    if (ids.has(expense.id)) return false;
    ids.add(expense.id);
  }
  return true;
}

function hasUsableExpenseState(state: KnownFinanceDemoState): boolean { return isRecord(state) && isValidFinanceExpenseGraph(state.expenses, state); }
function validToday(today: unknown): today is string { return isFinanceDate(today); }
function readableState<T extends KnownFinanceDemoState>(state: T, actor: Parameters<typeof actorMatchesFinanceState>[0]): KnownFinanceDemoState | null {
  if (!isGymFinanceActor(actor)) return actorMatchesFinanceState(actor, state) ? state : null;
  if (!actorMatchesFinanceState(actor, state)) return null;
  const owned = getValidatedGymFinanceDemoState(state);
  if (!owned || !actorMatchesOwnedFinanceState(actor, owned)) return null;
  originalGymInputs.set(owned, state);
  return owned;
}
function managedActor(rawCommand: unknown): ReturnType<typeof resolveFinanceCommandActor> {
  const resolution = resolveFinanceCommandActor(rawCommand);
  if (resolution.kind !== "resolved") return resolution;
  return canManageFinanceExpenses(resolution.actor) ? resolution : { kind: "denied" };
}

export function registerFinanceExpense<T extends KnownFinanceDemoState>(state: T, rawCommand: unknown, today?: string): ExpenseDemoTransition<T> {
  const authorization = managedActor(rawCommand);
  if (authorization.kind === "malformed") return failure(state, "El gasto no es válido.");
  if (authorization.kind !== "resolved") return failure(state, "No autorizado.");
  const graph = readableState(state, authorization.actor);
  if (!graph) return failure(state, "No autorizado.");
  state = graph as T; // Closed GYM capture is safe to narrow; BOX retains its original instance.
  if (!isRecord(rawCommand) || !hasOnlyKeys(rawCommand, ["id", "actor", "amountCents", "description", "spentAt"])
    || !hasOwn(rawCommand, "id") || !hasOwn(rawCommand, "actor") || !hasOwn(rawCommand, "amountCents") || !hasOwn(rawCommand, "description") || !hasOwn(rawCommand, "spentAt")) return failure(state, "El gasto no es válido.");
  if (!hasUsableExpenseState(state)) return failure(state, "Los gastos no son válidos.");
  if (!isId(rawCommand.id) || !isExpenseAmount(rawCommand.amountCents)) return failure(state, "El importe del gasto debe ser mayor a cero.");
  if (typeof rawCommand.description !== "string" || !rawCommand.description.trim()) return failure(state, "La descripción es obligatoria.");
  const effectiveToday = today ?? state.anchor;
  if (!isFinanceDate(rawCommand.spentAt) || !validToday(effectiveToday)) return failure(state, "La fecha del gasto no es válida.");
  if (rawCommand.spentAt > effectiveToday) return failure(state, "La fecha del gasto no puede ser futura.");
  if (state.expenses.some((expense) => expense.id === rawCommand.id)) return failure(state, "Identificador de gasto inválido.");
  const expense: FinanceExpense = { id: rawCommand.id, amountCents: rawCommand.amountCents, description: rawCommand.description.trim(), spentAt: rawCommand.spentAt, recordedById: authorization.actor.id };
  return result({ ...state, expenses: [...state.expenses, expense] }, { success: true, id: expense.id });
}

export function updateFinanceExpense<T extends KnownFinanceDemoState>(state: T, rawCommand: unknown): ExpenseDemoTransition<T> {
  const authorization = managedActor(rawCommand);
  if (authorization.kind === "malformed") return failure(state, "El gasto no es válido.");
  if (authorization.kind !== "resolved") return failure(state, "No autorizado.");
  const graph = readableState(state, authorization.actor);
  if (!graph) return failure(state, "No autorizado.");
  state = graph as T;
  if (!isRecord(rawCommand) || !hasOnlyKeys(rawCommand, ["actor", "expenseId", "amountCents", "description"]) || !hasOwn(rawCommand, "actor") || !hasOwn(rawCommand, "expenseId")) return failure(state, "El gasto no es válido.");
  if (!hasUsableExpenseState(state)) return failure(state, "Los gastos no son válidos.");
  if (!isId(rawCommand.expenseId)) return failure(state, "Gasto no encontrado.");
  const expense = state.expenses.find((candidate) => candidate.id === rawCommand.expenseId);
  if (!expense) return failure(state, "Gasto no encontrado.");
  const changes: Partial<Pick<FinanceExpense, "amountCents" | "description">> = {};
  if (hasOwn(rawCommand, "amountCents")) { if (!isExpenseAmount(rawCommand.amountCents)) return failure(state, "El importe del gasto debe ser mayor a cero."); changes.amountCents = rawCommand.amountCents; }
  if (hasOwn(rawCommand, "description")) { if (typeof rawCommand.description !== "string" || !rawCommand.description.trim()) return failure(state, "La descripción no puede estar vacía."); changes.description = rawCommand.description.trim(); }
  if (Object.keys(changes).length === 0) return failure(state, "No hay cambios para guardar.");
  return result({ ...state, expenses: state.expenses.map((candidate) => candidate.id === expense.id ? { ...candidate, ...changes } : candidate) }, { success: true, id: expense.id });
}

export function deleteFinanceExpense<T extends KnownFinanceDemoState>(state: T, rawCommand: unknown): ExpenseDemoTransition<T> {
  const authorization = managedActor(rawCommand);
  if (authorization.kind === "malformed") return failure(state, "El gasto no es válido.");
  if (authorization.kind !== "resolved") return failure(state, "No autorizado.");
  const graph = readableState(state, authorization.actor);
  if (!graph) return failure(state, "No autorizado.");
  state = graph as T;
  if (!isRecord(rawCommand) || !hasOnlyKeys(rawCommand, ["actor", "expenseId"]) || !hasOwn(rawCommand, "actor") || !hasOwn(rawCommand, "expenseId")) return failure(state, "El gasto no es válido.");
  if (!hasUsableExpenseState(state)) return failure(state, "Los gastos no son válidos.");
  if (!isId(rawCommand.expenseId) || !state.expenses.some((expense) => expense.id === rawCommand.expenseId)) return failure(state, "Gasto no encontrado.");
  return result({ ...state, expenses: state.expenses.filter((expense) => expense.id !== rawCommand.expenseId) }, { success: true, id: rawCommand.expenseId });
}
