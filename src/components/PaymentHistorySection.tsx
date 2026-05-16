"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { updatePayment, deletePayment } from "@/actions/payment";
import type { PaymentRecord, PaymentMethod } from "@/lib/payment-stats";

interface Props {
  payments: PaymentRecord[];
  isAdmin: boolean;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  MERCADO_PAGO: "Mercado Pago",
};

function formatDateDisplay(isoString: string): string {
  const d = new Date(isoString);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

interface EditDialogProps {
  payment: PaymentRecord;
  onClose: () => void;
}

function EditAmountDialog({ payment, onClose }: EditDialogProps) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const parsed = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      setError("El importe debe ser mayor a cero.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePayment(payment.id, parsed);
      if (!result.success) {
        setError("error" in result ? result.error : "Error al editar el pago.");
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Editar importe
        </h3>

        <div>
          <p className="text-xs text-gray-500 font-body mb-3">
            Alumno: <span className="text-white font-bold">{payment.studentName}</span>
            {" · "}
            Fecha: <span className="text-white font-bold">{formatDateDisplay(payment.paidAt)}</span>
          </p>
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
            Nuevo importe
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
              className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              autoFocus
            />
          </div>
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
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PaymentHistorySection({ payments, isAdmin }: Props) {
  const [editPayment, setEditPayment] = useState<PaymentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deletePayment(deleteTarget.id);
      if (!result.success) {
        setDeleteError("error" in result ? result.error : "Error al eliminar el pago.");
      } else {
        setDeleteTarget(null);
      }
    });
  }

  if (payments.length === 0) {
    return (
      <div className="border border-line p-6">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600 mb-4">
          Historial de pagos
        </p>
        <p className="text-sm text-gray-500 font-body italic">
          No hay pagos en el período seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Historial de pagos
          <span className="ml-2 text-gray-600">({payments.length})</span>
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel">
              {["Alumno", "Fecha", "Importe", "Método", "Registrado por", ...(isAdmin ? [""] : [])].map((h) => (
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
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-hover transition-colors duration-200">
                <td className="px-4 py-3 text-white font-heading font-bold">
                  {p.studentName}
                </td>
                <td className="px-4 py-3 text-gray-400 font-body text-xs">
                  {formatDateDisplay(p.paidAt)}
                </td>
                <td className="px-4 py-3 text-white font-heading font-bold tabular-nums">
                  ${p.amount.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-gray-400 font-body text-xs">
                  {p.paymentMethod ? METHOD_LABEL[p.paymentMethod] : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 font-body text-xs">
                  {p.recordedByName}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditPayment(p)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(p);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden flex flex-col divide-y divide-line">
        {payments.map((p) => (
          <div key={p.id} className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white font-heading font-bold text-sm">{p.studentName}</p>
                <p className="text-gray-500 text-xs font-body">{formatDateDisplay(p.paidAt)}</p>
              </div>
              <p className="text-white font-heading font-bold tabular-nums">
                ${p.amount.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
              </p>
            </div>
            <p className="text-gray-600 text-xs font-body">
              {p.paymentMethod ? METHOD_LABEL[p.paymentMethod] : "Sin método"} · Registrado por {p.recordedByName}
            </p>
            {isAdmin && (
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditPayment(p)}>
                  Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(p);
                  }}
                >
                  Eliminar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      {editPayment && (
        <EditAmountDialog
          payment={editPayment}
          onClose={() => setEditPayment(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar pago"
        message={
          deleteTarget
            ? `¿Eliminar el pago de $${deleteTarget.amount.toLocaleString("es-AR")} de ${deleteTarget.studentName} del ${formatDateDisplay(deleteTarget.paidAt)}? El próximo vencimiento del alumno no cambia.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />

      {deleteError && (
        <div className="px-4 py-2 border-t border-line">
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {deleteError}
          </p>
        </div>
      )}
    </div>
  );
}
