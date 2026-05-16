"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  RegisterPaymentDialog,
  type PaymentStudent,
} from "@/components/RegisterPaymentDialog";

interface Props {
  students: PaymentStudent[];
  demo?: boolean;
}

/**
 * "Registrar pago" button (top of the payments section) + dialog.
 * Rendered as a Client Component inside the Server Component page.
 */
export function RegisterPaymentButton({ students, demo }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Registrar pago
      </Button>
      <RegisterPaymentDialog
        students={students}
        open={open}
        onClose={() => setOpen(false)}
        demo={demo}
      />
    </>
  );
}

interface RowProps {
  students: PaymentStudent[];
  studentId: string;
  demo?: boolean;
}

/**
 * Per-row "Registrar pago" access button — opens the dialog pre-selecting the student.
 */
export function RegisterPaymentRowButton({ students, studentId, demo }: RowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Registrar pago
      </Button>
      <RegisterPaymentDialog
        students={students}
        preSelectedStudentId={studentId}
        open={open}
        onClose={() => setOpen(false)}
        demo={demo}
      />
    </>
  );
}
