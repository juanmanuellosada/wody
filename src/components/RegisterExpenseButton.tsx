"use client";

import { registerLiveExpense } from "@/components/RegisterExpenseDialog";
import { RegisterExpenseButtonView } from "@/components/expenses/RegisterExpenseButtonView";

export type {
  ExpenseDatePolicy,
  ExpenseRegistrationCallback,
  ExpenseRegistrationOptions,
  ExpenseRegistrationResult,
} from "@/components/expenses/RegisterExpenseDialogView";

interface Props {
  size?: "sm" | "md" | "lg";
}

/** "Registrar gasto" button — solo se debe renderizar detrás del gate canViewRevenue. */
export function RegisterExpenseButton({ size = "sm" }: Props) {
  return <RegisterExpenseButtonView size={size} onRegisterExpense={registerLiveExpense} />;
}
