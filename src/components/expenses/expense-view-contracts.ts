export type ExpenseRegistrationOptions = {
  spentAtStr?: string;
};

/** Matches the public result contract returned by the production expense action. */
export type ExpenseRegistrationResult =
  | { success: true }
  | { success: false; error: string };

/** Presentation preserves the production action's positional input contract. */
export type ExpenseRegistrationCallback = (
  amount: number,
  description: string,
  options?: ExpenseRegistrationOptions,
) => Promise<ExpenseRegistrationResult>;

/** Optional calendar source for local adapters; omission keeps the UTC live default. */
export type ExpenseDatePolicy = {
  today: () => string;
};

/** Resolves the date that initializes and bounds an expense form. */
export function resolveExpenseToday(datePolicy?: ExpenseDatePolicy): string {
  return datePolicy?.today() ?? new Date().toISOString().slice(0, 10);
}
