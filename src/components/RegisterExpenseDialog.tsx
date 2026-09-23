"use client";

import { registerExpense } from "@/actions/expense";
import {
  RegisterExpenseDialogView,
  type ExpenseRegistrationCallback,
} from "@/components/expenses/RegisterExpenseDialogView";

export type {
  ExpenseDatePolicy,
  ExpenseRegistrationCallback,
  ExpenseRegistrationOptions,
  ExpenseRegistrationResult,
} from "@/components/expenses/RegisterExpenseDialogView";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Production adapter: preserves the expense action's positional arguments and result contract. */
export const registerLiveExpense: ExpenseRegistrationCallback = (amount, description, options) =>
  registerExpense(amount, description, options);

/** Public production API retained for existing Caja callers. */
export function RegisterExpenseDialog({ open, onClose }: Props) {
  return <RegisterExpenseDialogView open={open} onClose={onClose} onRegisterExpense={registerLiveExpense} />;
}
