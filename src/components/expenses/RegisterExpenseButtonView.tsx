"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RegisterExpenseDialogView } from "./RegisterExpenseDialogView";
import type { ExpenseDatePolicy, ExpenseRegistrationCallback } from "./expense-view-contracts";

export interface RegisterExpenseButtonViewProps {
  size?: "sm" | "md" | "lg";
  datePolicy?: ExpenseDatePolicy;
  onRegisterExpense: ExpenseRegistrationCallback;
}

/** Reusable Caja action that owns only local open/close presentation state. */
export function RegisterExpenseButtonView({
  size = "sm",
  datePolicy,
  onRegisterExpense,
}: RegisterExpenseButtonViewProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        Registrar gasto
      </Button>
      <RegisterExpenseDialogView
        open={open}
        onClose={() => setOpen(false)}
        datePolicy={datePolicy}
        onRegisterExpense={onRegisterExpense}
      />
    </>
  );
}
