"use client";

import { updateExpense, deleteExpense } from "@/actions/expense";
import {
  ExpenseHistorySectionView,
  type UpdateExpenseCallback,
  type DeleteExpenseCallback,
} from "@/components/expenses/ExpenseHistorySectionView";
import type { ExpenseHistoryRecord } from "@/components/finance/history-view-contracts";

export type {
  ExpenseHistoryRecord as ExpenseRecord,
  UpdateExpenseCallback,
  DeleteExpenseCallback,
} from "@/components/expenses/ExpenseHistorySectionView";

interface Props {
  expenses: ExpenseHistoryRecord[];
}

/** Production adapters retain the live expense action argument and result contracts. */
export const updateLiveExpense: UpdateExpenseCallback = (expenseId, data) => updateExpense(expenseId, data);
export const deleteLiveExpense: DeleteExpenseCallback = (expenseId) => deleteExpense(expenseId);

/** Public production API retained for MixtaHistoryTabs callers. */
export function ExpenseHistorySection({ expenses }: Props) {
  return <ExpenseHistorySectionView expenses={expenses} onUpdateExpense={updateLiveExpense} onDeleteExpense={deleteLiveExpense} />;
}
