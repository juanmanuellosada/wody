"use client";

import { registerPayment } from "@/actions/payment";
import {
  RegisterPaymentDialogView,
  type PaymentRegistrationCallback,
  type PaymentStudent,
} from "@/components/payments/RegisterPaymentDialogView";

export type { PaymentStudent } from "@/components/payments/RegisterPaymentDialogView";

interface Props {
  students: PaymentStudent[];
  /** If provided, open with this student pre-selected */
  preSelectedStudentId?: string;
  /** Controlled open state */
  open: boolean;
  onClose: () => void;
  demo?: boolean;
}

/**
 * Production adapter. The extracted view deliberately passes raw input so this
 * wrapper retains the legacy parseFloat conversion and exact server-action arguments.
 */
export const registerLivePayment: PaymentRegistrationCallback = async (
  studentId,
  amountInput,
  nextPaymentDate,
  options,
) => registerPayment(studentId, parseFloat(amountInput.replace(",", ".")), nextPaymentDate, options);

/** Public production API retained for existing Caja callers. */
export function RegisterPaymentDialog({ students, preSelectedStudentId, open, onClose, demo }: Props) {
  return (
    <RegisterPaymentDialogView
      students={students}
      preSelectedStudentId={preSelectedStudentId}
      open={open}
      onClose={onClose}
      demo={demo}
      onRegisterPayment={registerLivePayment}
    />
  );
}
