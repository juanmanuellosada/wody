"use client";

import { RegisterPaymentSectionView } from "@/components/payments/RegisterPaymentSectionView";
import {
  registerLivePayment,
  type PaymentStudent,
} from "@/components/RegisterPaymentDialog";

interface Props {
  students: PaymentStudent[];
  demo?: boolean;
  size?: "sm" | "md" | "lg";
}

/** "Registrar pago" button (top of the payments section) + dialog. */
export function RegisterPaymentButton({ students, demo, size = "sm" }: Props) {
  return (
    <RegisterPaymentSectionView
      students={students}
      demo={demo}
      size={size}
      variant="primary"
      label="Registrar cuota"
      onRegisterPayment={registerLivePayment}
    />
  );
}

interface RowProps {
  students: PaymentStudent[];
  studentId: string;
  demo?: boolean;
}

/** Per-row "Registrar pago" access button — opens the dialog pre-selecting the student. */
export function RegisterPaymentRowButton({ students, studentId, demo }: RowProps) {
  return (
    <RegisterPaymentSectionView
      students={students}
      preSelectedStudentId={studentId}
      demo={demo}
      variant="secondary"
      label="Registrar pago"
      onRegisterPayment={registerLivePayment}
    />
  );
}
