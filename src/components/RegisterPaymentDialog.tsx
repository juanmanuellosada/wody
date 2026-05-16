"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { registerPayment } from "@/actions/payment";
import type { PaymentMethod } from "@/actions/payment";

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

/** Today as YYYY-MM-DD in UTC */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta (débito/crédito)",
  MERCADO_PAGO: "Mercado Pago",
};

const PAYMENT_METHODS: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "MERCADO_PAGO",
];

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

/** Typeahead student picker */
function StudentSearch({
  students,
  value,
  onChange,
  disabled,
}: {
  students: PaymentStudent[];
  value: string; // selected student id
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const selected = students.find((s) => s.id === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? students.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase())
      )
    : students;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        // Reset query to selected name if user didn't pick anything
        setQuery(selected?.name ?? "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
    if (e.target.value === "") {
      onChange("");
    }
  }

  function handleSelect(s: PaymentStudent) {
    setQuery(s.name);
    setOpen(false);
    onChange(s.id);
  }

  function handleFocus() {
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder="Escribí para buscar un alumno..."
        autoComplete="off"
        className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600 disabled:opacity-50"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-0.5 bg-panel border border-edge shadow-2xl shadow-black/50 max-h-52 overflow-y-auto">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  // prevent blur before click
                  e.preventDefault();
                  handleSelect(s);
                }}
                className={[
                  "w-full text-left px-3 py-2 text-sm font-body transition-colors duration-150 cursor-pointer",
                  s.id === value
                    ? "bg-brand-red/15 text-white"
                    : "text-gray-300 hover:bg-elev hover:text-white",
                ].join(" ")}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-50 left-0 right-0 mt-0.5 bg-panel border border-edge px-3 py-2 text-xs text-gray-500 font-body italic">
          Sin coincidencias.
        </div>
      )}
    </div>
  );
}

interface DuplicateInfo {
  studentName: string;
  paidAt: string;
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
  const [paidAt, setPaidAt] = useState(todayUTC());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicatePending, setDuplicatePending] = useState<DuplicateInfo | null>(null);

  function handleStudentChange(id: string) {
    setStudentId(id);
    setError(null);
    setDuplicatePending(null);
    const student = students.find((s) => s.id === id);
    if (student) {
      setAmount(student.lastAmount != null ? String(student.lastAmount) : "");
      setNextDate(student.suggestedNextDate);
    } else {
      setAmount("");
      setNextDate("");
    }
  }

  function validate(): { ok: false } | { ok: true; parsedAmount: number } {
    if (!studentId) {
      setError("Seleccioná un alumno.");
      return { ok: false };
    }
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("El importe debe ser mayor a cero.");
      return { ok: false };
    }
    if (!nextDate) {
      setError("Ingresá la próxima fecha de pago.");
      return { ok: false };
    }
    if (!paidAt) {
      setError("Ingresá la fecha del pago.");
      return { ok: false };
    }
    return { ok: true, parsedAmount };
  }

  function handleConfirm() {
    const v = validate();
    if (!v.ok) return;
    if (demo) {
      onClose();
      return;
    }
    setError(null);
    setDuplicatePending(null);
    startTransition(async () => {
      const result = await registerPayment(studentId, v.parsedAmount, nextDate, {
        paidAtStr: paidAt,
        paymentMethod,
        confirmedDuplicate: false,
      });
      if (!result.success && "requiresConfirmation" in result) {
        setDuplicatePending(result.duplicateInfo);
      } else if (!result.success && "error" in result) {
        setError(result.error);
      } else if (result.success) {
        onClose();
      }
    });
  }

  function handleConfirmDuplicate() {
    const v = validate();
    if (!v.ok) return;
    setError(null);
    setDuplicatePending(null);
    startTransition(async () => {
      const result = await registerPayment(studentId, v.parsedAmount, nextDate, {
        paidAtStr: paidAt,
        paymentMethod,
        confirmedDuplicate: true,
      });
      if (!result.success) {
        setError("error" in result ? result.error : "Error al registrar el pago.");
      } else {
        onClose();
      }
    });
  }

  if (duplicatePending) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
          <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
            Pago duplicado
          </h3>
          <p className="text-sm font-body text-gray-300">
            Ya hay un pago de{" "}
            <span className="text-white font-bold">{duplicatePending.studentName}</span>{" "}
            con fecha{" "}
            <span className="text-white font-bold">{duplicatePending.paidAt}</span>.
            ¿Registrar otro de todas formas?
          </p>
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
              onClick={() => setDuplicatePending(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmDuplicate}
              loading={isPending}
            >
              Registrar igual
            </Button>
          </div>
        </div>
      </div>
    );
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
          {/* Student typeahead */}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Alumno
            </label>
            <StudentSearch
              students={students}
              value={studentId}
              onChange={handleStudentChange}
              disabled={isPending}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Importe
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-body pointer-events-none select-none">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const raw = e.target.value;
                  // Allow empty, digits, and at most 2 decimal places
                  if (raw === "" || /^\d*([.,]\d{0,2})?$/.test(raw)) {
                    setAmount(raw);
                  }
                }}
                disabled={isPending}
                placeholder="Ej: 15000"
                className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Payment date — editable, default today, no future dates */}
          <DatePicker
            value={paidAt}
            onChange={(d) => {
              const today = todayUTC();
              if (d > today) return; // silently block future dates
              setPaidAt(d);
            }}
            disabled={isPending}
            label="Fecha del pago"
            max={todayUTC()}
          />

          {/* Payment method — required */}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Método de pago
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 disabled:opacity-50 cursor-pointer"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {/* Next payment date */}
          {nextDate ? (
            <DatePicker
              value={nextDate}
              onChange={setNextDate}
              disabled={isPending}
              label="Próximo vencimiento"
            />
          ) : (
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Próximo vencimiento
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
