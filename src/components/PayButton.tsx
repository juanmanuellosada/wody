"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { markStudentAsPaid } from "@/actions/payment";

interface Props {
  studentId: string;
  studentName: string;
}

export function PayButton({ studentId, studentName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function handleClick() {
    if (isPending) return;
    setError(null);
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await markStudentAsPaid(studentId);
      if (!result.success) setError(result.error);
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        size="sm"
        onClick={handleClick}
        loading={isPending}
      >
        Marcar pagado
      </Button>
      {error && (
        <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title="Registrar pago"
        message={`¿Registrar pago de ${studentName}? La fecha avanza 1 mes.`}
        confirmLabel="Registrar"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
