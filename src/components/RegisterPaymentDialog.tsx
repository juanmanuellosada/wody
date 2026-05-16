"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { registerPayment } from "@/actions/payment";

export interface PaymentStudent {
  id: string;
  name: string;
  /** Suggested next payment date: nextPaymentDate + 1 month, as YYYY-MM-DD string */
  suggestedNextDate: string;
  /** Last paid amount for this student, or null if no prior payments */
  lastAmount: number | null;
}

interface Props {
  students: PaymentStudent[];
  /** If provided, open with this student pre-selected */
  preSelectedStudentId?: string;
  /** Controlled open state */
  open: boolean;
  onClose: () => void;
  demo?: boolean;
}

function initialState(
  students: PaymentStudent[],
  preSelectedStudentId: string | undefined
) {
  const id = preSelectedStudentId ?? "";
  const student = students.find((s) => s.id === id);
  return {
    studentId: id,
    amount: student?.lastAmount != null ? String(student.lastAmount) : "",
    nextDate: student?.suggestedNextDate ?? "",
  };
}

/**
 * Inner form — remounted via `key` each time the dialog opens, so initial
 * state is always derived from the latest props without an effect.
 */
function DialogForm({
  students,
  onClose,
  demo,
  defaultStudentId,
  defaultAmount,
  defaultNextDate,
}: {
  students: PaymentStudent[];
  onClose: () => void;
  demo?: boolean;
  defaultStudentId: string;
  defaultAmount: string;
  defaultNextDate: string;
}) {
  const [studentId, setStudentId] = useState(defaultStudentId);
  const [amount, setAmount] = useState(defaultAmount);
  const [nextDate, setNextDate] = useState(defaultNextDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStudentChange(id: string) {
    setStudentId(id);
    setError(null);
    const student = students.find((s) => s.id === id);
    if (student) {
      setAmount(student.lastAmount != null ? String(student.lastAmount) : "");
      setNextDate(student.suggestedNextDate);
    } else {
      setAmount("");
      setNextDate("");
    }
  }

  function handleConfirm() {
    if (!studentId) {
      setError("Seleccioná un alumno.");
      return;
    }
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("El importe debe ser mayor a cero.");
      return;
    }
    if (!nextDate) {
      setError("Ingresá la próxima fecha de pago.");
      return;
    }
    if (demo) {
      onClose();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await registerPayment(studentId, parsedAmount, nextDate);
      if (!result.success) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Registrar Pago
        </h3>

        <div className="flex flex-col gap-3">
          {/* Student selector */}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Alumno
            </label>
            <select
              value={studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 appearance-none"
            >
              <option value="">Seleccioná un alumno...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Importe
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
              placeholder="Ej: 15000"
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
            />
          </div>

          {/* Next payment date */}
          {nextDate ? (
            <DatePicker
              value={nextDate}
              onChange={setNextDate}
              disabled={isPending}
              label="Próxima fecha de pago"
            />
          ) : (
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Próxima fecha de pago
              </label>
              <p className="text-xs text-gray-600 font-body italic">
                Seleccioná un alumno para ver la fecha sugerida.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p
            className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            loading={isPending}
          >
            Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper that controls open state. Uses a `key` to remount `DialogForm`
 * each time the dialog opens so initial field values are always fresh.
 */
export function RegisterPaymentDialog({
  students,
  preSelectedStudentId,
  open,
  onClose,
  demo,
}: Props) {
  if (!open) return null;

  const { studentId, amount, nextDate } = initialState(
    students,
    preSelectedStudentId
  );

  return (
    <DialogForm
      students={students}
      onClose={onClose}
      demo={demo}
      defaultStudentId={studentId}
      defaultAmount={amount}
      defaultNextDate={nextDate}
    />
  );
}
