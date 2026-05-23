"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  registerPersonalPayment,
  setPersonalUserBlocked,
  setPersonalUserPaymentExempt,
  type PaymentMethod,
  type PersonalUserRow,
} from "@/actions/super-admin/personal-users";

// ─── Utils ────────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Los usuarios registrados por modo personal traen `nextPaymentDate = 9999-12-31`
 * como sentinel de "sin vencimiento programado" (el campo es NOT NULL en el schema).
 */
function isUnscheduled(d: Date): boolean {
  return d.getUTCFullYear() >= 9000;
}

function suggestNextDate(nextPaymentDate: Date): string {
  // Sentinel "sin programar": sugerir hoy + 30 días. Si calculáramos sobre el
  // sentinel, setUTCMonth desbordaría al año 10000 y toISOString rompería el
  // formato YYYY-MM-DD que espera el DatePicker.
  const base = isUnscheduled(nextPaymentDate) ? new Date() : new Date(nextPaymentDate);
  base.setUTCDate(base.getUTCDate() + (isUnscheduled(nextPaymentDate) ? 30 : 0));
  if (!isUnscheduled(nextPaymentDate)) base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
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

// ─── Register payment dialog (personal-mode variant) ─────────────────────────

interface DialogProps {
  student: PersonalUserRow;
  onClose: () => void;
}

function RegisterPersonalPaymentDialog({ student, onClose }: DialogProps) {
  const [amount, setAmount] = useState(
    student.lastAmount != null ? String(student.lastAmount) : ""
  );
  const [nextDate, setNextDate] = useState(suggestNextDate(student.nextPaymentDate));
  const [paidAt, setPaidAt] = useState(todayUTC());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [duplicatePending, setDuplicatePending] = useState<{
    studentName: string;
    paidAt: string;
  } | null>(null);

  function validate():
    | { ok: false }
    | { ok: true; parsedAmount: number } {
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
    setError(null);
    setDuplicatePending(null);
    startTransition(async () => {
      const result = await registerPersonalPayment(student.id, v.parsedAmount, nextDate, {
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
      const result = await registerPersonalPayment(student.id, v.parsedAmount, nextDate, {
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
            <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setDuplicatePending(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmDuplicate} loading={isPending}>
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
          Registrar Pago — {student.name}
        </h3>

        {student.paymentExempt && (
          <div className="border border-purple-500/30 bg-purple-500/10 px-3 py-2 flex items-start gap-2">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full flex-shrink-0 mt-1" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-purple-400">
                Usuario exento de pago
              </p>
              {student.paymentExemptReason && (
                <p className="text-xs text-gray-400 font-body">{student.paymentExemptReason}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
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

          {/* Paid at */}
          <DatePicker
            value={paidAt}
            onChange={(d) => {
              if (d > todayUTC()) return;
              setPaidAt(d);
            }}
            disabled={isPending}
            label="Fecha del pago"
            max={todayUTC()}
          />

          {/* Payment method */}
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
          <DatePicker
            value={nextDate}
            onChange={setNextDate}
            disabled={isPending}
            label="Próximo vencimiento"
          />
        </div>

        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} loading={isPending}>
            Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Exempt dialog (with optional reason) ────────────────────────────────────

interface ExemptDialogProps {
  student: PersonalUserRow;
  onClose: () => void;
}

function SetExemptDialog({ student, onClose }: ExemptDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await setPersonalUserPaymentExempt(student.id, true, reason);
      if (!result.success) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}
    >
      <div className="w-full max-w-sm bg-panel border border-line p-6 flex flex-col gap-5" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
            Marcar exento — {student.name}
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Cerrar"
          >
            &#215;
          </button>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed">
          El usuario no recibirá recordatorios de pago ni aparecerá en mora.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
            Motivo (opcional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            placeholder="Ej: Staff, becado, acuerdo especial..."
            rows={2}
            className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600 resize-none"
          />
        </div>
        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} loading={isPending} className="flex-1">
            Marcar exento
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Exempt toggle button ─────────────────────────────────────────────────────

function ExemptRowButton({ student }: { student: PersonalUserRow }) {
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRemoveConfirm() {
    startTransition(async () => {
      await setPersonalUserPaymentExempt(student.id, false, null);
      setShowRemoveConfirm(false);
    });
  }

  if (student.paymentExempt) {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setShowRemoveConfirm(true)}>
          Quitar exento
        </Button>
        <ConfirmDialog
          open={showRemoveConfirm}
          title="Quitar exención"
          message={`¿Quitar la exención de pago a ${student.name}? Volverá a regirse por su fecha de vencimiento.`}
          confirmLabel="Quitar exención"
          variant="danger"
          loading={isPending}
          onConfirm={handleRemoveConfirm}
          onCancel={() => setShowRemoveConfirm(false)}
        />
      </>
    );
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setShowSetDialog(true)}>
        Marcar exento
      </Button>
      {showSetDialog && (
        <SetExemptDialog student={student} onClose={() => setShowSetDialog(false)} />
      )}
    </>
  );
}

// ─── Block toggle button ──────────────────────────────────────────────────────

function BlockRowButton({ student }: { student: PersonalUserRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isBlocked = student.blockedAt !== null;

  function handleConfirm() {
    startTransition(async () => {
      await setPersonalUserBlocked(student.id, !isBlocked);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant={isBlocked ? "secondary" : "danger"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isBlocked ? "Desbloquear" : "Bloquear"}
      </Button>
      <ConfirmDialog
        open={open}
        title={isBlocked ? "Desbloquear usuario" : "Bloquear usuario"}
        message={
          isBlocked
            ? `¿Desbloquear a ${student.name}? Podrá volver a loguearse.`
            : `¿Bloquear a ${student.name}? No podrá loguearse hasta que lo desbloques.`
        }
        confirmLabel={isBlocked ? "Desbloquear" : "Bloquear"}
        variant={isBlocked ? "primary" : "danger"}
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

// ─── Per-row button ───────────────────────────────────────────────────────────

function RegisterPaymentRowButton({ student }: { student: PersonalUserRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Registrar pago
      </Button>
      {open && (
        <RegisterPersonalPaymentDialog student={student} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface TableProps {
  users: PersonalUserRow[];
}

export function PersonalUsersTable({ users }: TableProps) {
  const now = new Date();

  function getStatus(u: PersonalUserRow): { label: string; className: string } {
    if (u.blockedAt) {
      return {
        label: "Bloqueado",
        className:
          "px-2 py-0.5 text-xs font-heading font-bold uppercase tracking-[0.15em] bg-red-900/30 text-red-400 border border-red-700/40",
      };
    }
    if (u.paymentExempt) {
      return {
        label: "Exento",
        className:
          "px-2 py-0.5 text-xs font-heading font-bold uppercase tracking-[0.15em] bg-purple-500/15 text-purple-400 border border-purple-500/30",
      };
    }
    if (isUnscheduled(u.nextPaymentDate)) {
      return {
        label: "Sin programar",
        className:
          "px-2 py-0.5 text-xs font-heading font-bold uppercase tracking-[0.15em] bg-white/5 text-gray-500 border border-edge",
      };
    }
    if (u.nextPaymentDate < now) {
      return {
        label: "Vencido",
        className:
          "px-2 py-0.5 text-xs font-heading font-bold uppercase tracking-[0.15em] bg-brand-red/15 text-brand-red border border-brand-red/30",
      };
    }
    return {
      label: "Al día",
      className:
        "px-2 py-0.5 text-xs font-heading font-bold uppercase tracking-[0.15em] bg-white/5 text-gray-400 border border-edge",
    };
  }

  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-panel">
            {["Nombre", "Email", "Próximo vencimiento", "Estado", "Acción"].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const status = getStatus(u);
            const overdue = !u.paymentExempt && !u.blockedAt && u.nextPaymentDate < now;
            return (
              <tr key={u.id} className="border-b border-line hover:bg-hover transition-colors duration-200">
                <td className="px-4 py-3.5 text-white font-heading font-bold">
                  {u.name}
                  {u.accountKind === "LITE" && (
                    <span className="ml-2 text-xs font-body text-gray-500">(lite)</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-gray-400 font-body text-xs">
                  {u.email ?? <span className="text-gray-600 italic">sin email</span>}
                </td>
                <td className="px-4 py-3.5 font-body text-xs">
                  {isUnscheduled(u.nextPaymentDate) ? (
                    <span className="text-gray-600">—</span>
                  ) : (
                    <span className={overdue ? "text-brand-red font-bold" : "text-gray-300"}>
                      {u.nextPaymentDate.toLocaleDateString("es-AR")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className={status.className}>{status.label}</span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RegisterPaymentRowButton student={u} />
                    <ExemptRowButton student={u} />
                    <BlockRowButton student={u} />
                  </div>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-600 font-body text-xs">
                No hay usuarios en modo personal.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
