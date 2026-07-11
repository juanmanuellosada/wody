"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RegisterExpenseDialog } from "@/components/RegisterExpenseDialog";

interface Props {
  size?: "sm" | "md" | "lg";
}

/** "Registrar gasto" button — solo se debe renderizar detrás del gate canViewRevenue. */
export function RegisterExpenseButton({ size = "sm" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        Registrar gasto
      </Button>
      <RegisterExpenseDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
