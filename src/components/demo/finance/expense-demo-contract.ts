// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX, financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveCatalogSaleActor } from "./catalog-sales-state.ts";
import type { CatalogSaleActor } from "./catalog-sales-contract";

export type ExpenseDemoResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type ExpenseDemoTransition<State> = { state: State; result: ExpenseDemoResult };

export type RegisterExpenseCommand = {
  id: unknown;
  actor: unknown;
  amountCents: unknown;
  description: unknown;
  spentAt: unknown;
};

export type UpdateExpenseCommand = {
  actor: unknown;
  expenseId: unknown;
  amountCents?: unknown;
  description?: unknown;
};

export type DeleteExpenseCommand = {
  actor: unknown;
  expenseId: unknown;
};

/** Expense authorization reuses the immutable catalog policy rather than accepting caller claims. */
export function resolveExpenseActor(value: unknown): CatalogSaleActor | null {
  return resolveCatalogSaleActor(value);
}

export function canManageExpenses(value: unknown): boolean {
  const actor = resolveExpenseActor(value);
  return actor?.role === "ADMIN" && actor.canViewRevenue === true;
}

export function isKnownExpenseRecorder(id: unknown): boolean {
  return typeof id === "string" && Object.values(financeCatalogSaleActors)
    .some((actor) => actor.id === id && actor.role === "ADMIN" && actor.canViewRevenue === true);
}

export { FINANCE_CENTS_MAX };
