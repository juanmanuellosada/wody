"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  RegisterPaymentDialogView,
  type PaymentRegistrationCallback,
  type PaymentStudent,
} from "./RegisterPaymentDialogView";

export interface RegisterPaymentSectionViewProps {
  students: PaymentStudent[];
  preSelectedStudentId?: string;
  demo?: boolean;
  size?: "sm" | "md" | "lg";
  variant: "primary" | "secondary";
  label: string;
  onRegisterPayment: PaymentRegistrationCallback;
}

/** Exact payment trigger plus extracted dialog; adapters provide only the callback boundary. */
export function RegisterPaymentSectionView({
  students,
  preSelectedStudentId,
  demo,
  size = "sm",
  variant,
  label,
  onRegisterPayment,
}: RegisterPaymentSectionViewProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <RegisterPaymentDialogView
        students={students}
        preSelectedStudentId={preSelectedStudentId}
        open={open}
        onClose={() => setOpen(false)}
        demo={demo}
        onRegisterPayment={onRegisterPayment}
      />
    </>
  );
}
