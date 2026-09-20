"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";

export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";

export interface PaymentStudent {
  id: string;
  name: string;
  /** Suggested next payment date: nextPaymentDate + 1 month, as YYYY-MM-DD string */
  suggestedNextDate: string;
  /** Last paid amount for this student, or null if no prior payments */
  lastAmount: number | null;
  paymentExempt?: boolean;
  paymentExemptReason?: string | null;
}

export type PaymentRegistrationOptions = {
  paidAtStr: string;
  paymentMethod: PaymentMethod;
  confirmedDuplicate: boolean;
};

export type PaymentRegistrationResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; requiresConfirmation: true; duplicateInfo: { studentName: string; paidAt: string } };

/** The view owns form state; adapters own conversion, persistence, and side effects. */
export type PaymentRegistrationCallback = (
  studentId: string,
  amountInput: string,
  nextPaymentDate: string,
  options: PaymentRegistrationOptions,
) => Promise<PaymentRegistrationResult>;

export interface RegisterPaymentDialogViewProps {
  students: PaymentStudent[];
  /** If provided, open with this student pre-selected */
  preSelectedStudentId?: string;
  /** Controlled open state */
  open: boolean;
  onClose: () => void;
  /** Preserves the existing legacy demo no-op behavior. */
  demo?: boolean;
  onRegisterPayment: PaymentRegistrationCallback;
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

function initialState(students: PaymentStudent[], preSelectedStudentId: string | undefined) {
  const id = preSelectedStudentId ?? "";
  const student = students.find((candidate) => candidate.id === id);
  const hasStudent = !!student;
  return {
    studentId: id,
    amount: student?.lastAmount != null ? String(student.lastAmount) : "",
    nextDate: student?.suggestedNextDate ?? "",
    /** Pre-fill date/method only when a student is already selected at open time */
    paidAt: hasStudent ? todayUTC() : "",
    paymentMethod: hasStudent ? ("EFECTIVO" as PaymentMethod) : ("" as PaymentMethod | ""),
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
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const selected = students.find((student) => student.id === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = query.trim()
    ? students.filter((student) => student.name.toLowerCase().includes(query.toLowerCase()))
    : students;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.name ?? "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (event.target.value === "") onChange("");
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Escribí para buscar un alumno..."
        autoComplete="off"
        className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600 disabled:opacity-50"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-0.5 bg-panel border border-edge shadow-2xl shadow-black/50 max-h-52 overflow-y-auto">
          {filtered.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setQuery(student.name);
                  setOpen(false);
                  onChange(student.id);
                }}
                className={[
                  "w-full text-left px-3 py-2 text-sm font-body transition-colors duration-150 cursor-pointer",
                  student.id === value ? "bg-brand-red/15 text-white" : "text-gray-300 hover:bg-elev hover:text-white",
                ].join(" ")}
              >
                {student.name}
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

type DuplicateInfo = { studentName: string; paidAt: string };

function DialogForm({
  students,
  onClose,
  demo,
  onRegisterPayment,
  defaultStudentId,
  defaultAmount,
  defaultNextDate,
  defaultPaidAt,
  defaultPaymentMethod,
}: Omit<RegisterPaymentDialogViewProps, "open" | "preSelectedStudentId"> & {
  defaultStudentId: string;
  defaultAmount: string;
  defaultNextDate: string;
  defaultPaidAt: string;
  defaultPaymentMethod: PaymentMethod | "";
}) {
  const [studentId, setStudentId] = useState(defaultStudentId);
  const [amount, setAmount] = useState(defaultAmount);
  const [nextDate, setNextDate] = useState(defaultNextDate);
  const [paidAt, setPaidAt] = useState(defaultPaidAt);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(defaultPaymentMethod);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicatePending, setDuplicatePending] = useState<DuplicateInfo | null>(null);

  function handleStudentChange(id: string) {
    setStudentId(id);
    setError(null);
    setDuplicatePending(null);
    const student = students.find((candidate) => candidate.id === id);
    if (student) {
      setAmount(student.lastAmount != null ? String(student.lastAmount) : "");
      setNextDate(student.suggestedNextDate);
      setPaidAt((previous) => previous || todayUTC());
      setPaymentMethod((previous) => previous || "EFECTIVO");
    } else {
      setAmount("");
      setNextDate("");
      setPaidAt("");
      setPaymentMethod("");
    }
  }

  function validate(): { ok: false } | { ok: true; resolvedMethod: PaymentMethod } {
    if (!studentId) {
      setError("Seleccioná un alumno.");
      return { ok: false };
    }
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
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
    if (!paymentMethod) {
      setError("Seleccioná el método de pago.");
      return { ok: false };
    }
    return { ok: true, resolvedMethod: paymentMethod };
  }

  function submit(confirmedDuplicate: boolean) {
    const validation = validate();
    if (!validation.ok) return;
    if (demo) {
      onClose();
      return;
    }
    setError(null);
    setDuplicatePending(null);
    startTransition(async () => {
      const result = await onRegisterPayment(studentId, amount, nextDate, {
        paidAtStr: paidAt,
        paymentMethod: validation.resolvedMethod,
        confirmedDuplicate,
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

  if (duplicatePending) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={(event) => event.target === event.currentTarget && onClose()}>
        <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
          <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">Pago duplicado</h3>
          <p className="text-sm font-body text-gray-300">
            Ya hay un pago de <span className="text-white font-bold">{duplicatePending.studentName}</span> con fecha{" "}
            <span className="text-white font-bold">{duplicatePending.paidAt}</span>. ¿Registrar otro de todas formas?
          </p>
          {error && <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setDuplicatePending(null)} disabled={isPending}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={() => submit(true)} loading={isPending}>Registrar igual</Button>
          </div>
        </div>
      </div>
    );
  }

  const selectedStudent = students.find((student) => student.id === studentId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">Registrar Cuota</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">Alumno</label>
            <StudentSearch students={students} value={studentId} onChange={handleStudentChange} disabled={isPending} />
          </div>
          {studentId && selectedStudent?.paymentExempt && (
            <div className="border border-purple-500/30 bg-purple-500/10 px-3 py-2 flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0 mt-1" aria-hidden="true" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-purple-400">Alumno exento de pago</p>
                {selectedStudent.paymentExemptReason && <p className="text-xs text-gray-400 font-body">{selectedStudent.paymentExemptReason}</p>}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">Importe</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-body pointer-events-none select-none">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "" || /^\d*([.,]\d{0,2})?$/.test(raw)) setAmount(raw);
                }}
                disabled={isPending}
                placeholder="Ej: 15000"
                className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
              />
            </div>
          </div>
          {paidAt ? (
            <DatePicker
              value={paidAt}
              onChange={(date) => {
                const today = todayUTC();
                if (date > today) return;
                setPaidAt(date);
              }}
              disabled={isPending}
              label="Fecha del pago"
              max={todayUTC()}
            />
          ) : (
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">Fecha del pago</label>
              <p className="text-xs text-gray-600 font-body italic">Seleccioná un alumno para ingresar la fecha.</p>
            </div>
          )}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">Método de pago</label>
            {paymentMethod ? (
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} disabled={isPending} className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 disabled:opacity-50 cursor-pointer">
                {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>)}
              </select>
            ) : <p className="text-xs text-gray-600 font-body italic">Seleccioná un alumno para elegir el método.</p>}
          </div>
          {nextDate ? (
            <DatePicker value={nextDate} onChange={setNextDate} disabled={isPending} label="Próximo vencimiento" />
          ) : (
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">Próximo vencimiento</label>
              <p className="text-xs text-gray-600 font-body italic">Seleccioná un alumno para ver la fecha sugerida.</p>
            </div>
          )}
        </div>
        {error && <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={() => submit(false)} loading={isPending}>Registrar</Button>
        </div>
      </div>
    </div>
  );
}

/** Controlled extracted presentation. Returning null remounts fresh defaults on every later open. */
export function RegisterPaymentDialogView({ students, preSelectedStudentId, open, onClose, demo, onRegisterPayment }: RegisterPaymentDialogViewProps) {
  if (!open) return null;
  const { studentId, amount, nextDate, paidAt, paymentMethod } = initialState(students, preSelectedStudentId);
  return (
    <DialogForm
      students={students}
      onClose={onClose}
      demo={demo}
      onRegisterPayment={onRegisterPayment}
      defaultStudentId={studentId}
      defaultAmount={amount}
      defaultNextDate={nextDate}
      defaultPaidAt={paidAt}
      defaultPaymentMethod={paymentMethod}
    />
  );
}
