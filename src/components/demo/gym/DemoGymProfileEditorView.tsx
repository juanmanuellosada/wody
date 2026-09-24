"use client";

import { Button } from "@/components/ui/Button";

export interface DemoGymProfileEditorViewProps {
  /** ADMIN/TEACHER can always edit the name; exemption is ADMIN-only, matching the core. */
  isAdmin: boolean;
  name: string;
  onNameChange: (next: string) => void;
  onSaveName: () => void;
  paymentExempt: boolean;
  paymentExemptReason: string;
  onPaymentExemptReasonChange: (next: string) => void;
  onTogglePaymentExempt: () => void;
  pending: boolean;
  error: string | null;
  onClose: () => void;
}

/**
 * Presentation-only GYM profile editor for the Cuotas bridge. Mirrors the relevant subset of
 * StudentEditor's markup (name / payment exemption) with props-driven callbacks instead of
 * imported server actions, since StudentEditor itself calls its six actions inline and is shared
 * by two live production pages: extracting a *View from it would force a broad production
 * refactor. Type change, own-routines, payment date and teacher assignment are intentionally
 * absent; assignment was removed after review because nothing in the GYM finance/authorization
 * path reads the profile bridge's links yet (projectGymFinanceFeesData's TEACHER scoping and
 * canRecordFinancePayment's authorization both still re-derive from the canonical directory), so
 * an assign/unassign control here would visibly change without ever taking effect elsewhere.
 */
export function DemoGymProfileEditorView({
  isAdmin,
  name,
  onNameChange,
  onSaveName,
  paymentExempt,
  paymentExemptReason,
  onPaymentExemptReasonChange,
  onTogglePaymentExempt,
  pending,
  error,
  onClose,
}: DemoGymProfileEditorViewProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => !pending && e.target === e.currentTarget && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Editar Alumno
        </h3>

        <div>
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={pending}
            className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
          />
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 block">
              Exento de pago
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 font-body">
                {paymentExempt
                  ? "No se le cobra cuota. No aparece en mora ni recibe recordatorios."
                  : "Se rige por su próxima fecha de pago."}
              </p>
              <Button
                variant={paymentExempt ? "danger" : "primary"}
                size="sm"
                onClick={onTogglePaymentExempt}
                disabled={pending}
              >
                {paymentExempt ? "Quitar exención" : "Marcar exento"}
              </Button>
            </div>
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Motivo (opcional)
              </label>
              <textarea
                value={paymentExemptReason}
                onChange={(e) => onPaymentExemptReasonChange(e.target.value)}
                disabled={pending}
                placeholder="Ej: Hijo del dueño, staff, becado..."
                rows={2}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600 resize-none"
              />
              <p className="text-[10px] text-gray-600 font-body mt-1">
                El motivo se guarda al marcar o quitar la exención.
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Cerrar
          </Button>
          <Button variant="primary" size="sm" onClick={onSaveName} loading={pending}>
            Guardar nombre
          </Button>
        </div>
      </div>
    </div>
  );
}
