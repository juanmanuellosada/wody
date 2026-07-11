"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { updateExpense, deleteExpense } from "@/actions/expense";
import type { ExpenseRecord } from "@/lib/finance-stats";

interface Props {
  expenses: ExpenseRecord[];
}

function formatDateDisplay(isoString: string): string {
  const d = new Date(isoString);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function EditExpenseDialog({ expense, onClose }: { expense: ExpenseRecord; onClose: () => void }) {
  const [amount, setAmount] = useState(String(expense.amount));
  const [description, setDescription] = useState(expense.description);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const parsed = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || isNaN(parsed) || parsed <= 0) {
      setError("El importe debe ser mayor a cero.");
      return;
    }
    if (!description.trim()) {
      setError("La descripción no puede estar vacía.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateExpense(expense.id, { amount: parsed, description });
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
      onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">Editar gasto</h3>
        <p className="text-xs text-gray-500 font-body">
          Fecha: <span className="text-white font-bold">{formatDateDisplay(expense.spentAt)}</span>
        </p>
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
                if (raw === "" || /^\d*([.,]\d{0,2})?$/.test(raw)) setAmount(raw);
              }}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
            rows={3}
            className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 resize-none"
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
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ExpenseHistorySection({ expenses }: Props) {
  const [editExpense, setEditExpense] = useState<ExpenseRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteExpense(deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error);
      } else {
        setDeleteTarget(null);
      }
    });
  }

  if (expenses.length === 0) {
    return (
      <div className="border border-line p-6">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600 mb-4">
          Historial de gastos
        </p>
        <p className="text-sm text-gray-500 font-body italic">No hay gastos en el período seleccionado.</p>
      </div>
    );
  }

  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Historial de gastos
          <span className="ml-2 text-gray-600">({expenses.length})</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel">
              {["Descripción", "Fecha", "Importe", "Registrado por", ""].map((h) => (
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
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0 hover:bg-hover transition-colors duration-200">
                <td className="px-4 py-3 text-white font-heading font-bold">{e.description}</td>
                <td className="px-4 py-3 text-gray-400 font-body text-xs">{formatDateDisplay(e.spentAt)}</td>
                <td className="px-4 py-3 text-white font-heading font-bold tabular-nums">
                  ${e.amount.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-gray-500 font-body text-xs">{e.recordedByName}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditExpense(e)}>
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(e);
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editExpense && <EditExpenseDialog expense={editExpense} onClose={() => setEditExpense(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar gasto"
        message={deleteTarget ? `¿Eliminar el gasto "${deleteTarget.description}" del ${formatDateDisplay(deleteTarget.spentAt)}?` : ""}
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
