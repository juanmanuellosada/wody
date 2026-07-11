"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { updateSale, deleteSale } from "@/actions/sale";
import type { SaleRecord } from "@/lib/finance-stats";
import type { PaymentMethod } from "@/lib/payment-stats";

interface Props {
  sales: SaleRecord[];
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
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function EditSaleDialog({ sale, onClose }: { sale: SaleRecord; onClose: () => void }) {
  const [quantity, setQuantity] = useState(String(sale.quantity));
  const [unitAmount, setUnitAmount] = useState(String(sale.unitAmount));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    const q = parseInt(quantity, 10);
    const u = parseFloat(unitAmount.replace(",", "."));
    if (!quantity.trim() || isNaN(q) || q < 1) {
      setError("La cantidad debe ser un entero mayor o igual a 1.");
      return;
    }
    if (!unitAmount.trim() || isNaN(u) || u < 0) {
      setError("El importe unitario debe ser mayor o igual a cero.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateSale(sale.id, { quantity: q, unitAmount: u });
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
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">Editar venta</h3>
        <p className="text-xs text-gray-500 font-body">
          Producto: <span className="text-white font-bold">{sale.productDescription}</span>
          {" · "}Fecha: <span className="text-white font-bold">{formatDateDisplay(sale.soldAt)}</span>
        </p>
        <div>
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
            Cantidad
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "" || /^\d*$/.test(raw)) setQuantity(raw);
            }}
            disabled={isPending}
            className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
          />
        </div>
        <div>
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
            Importe unitario
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-body pointer-events-none select-none">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={unitAmount}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "" || /^\d*([.,]\d{0,2})?$/.test(raw)) setUnitAmount(raw);
              }}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
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

export function SaleHistorySection({ sales }: Props) {
  const [editSale, setEditSale] = useState<SaleRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SaleRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteSale(deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error);
      } else {
        setDeleteTarget(null);
      }
    });
  }

  if (sales.length === 0) {
    return (
      <div className="border border-line p-6">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600 mb-4">
          Historial de ventas
        </p>
        <p className="text-sm text-gray-500 font-body italic">No hay ventas en el período seleccionado.</p>
      </div>
    );
  }

  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Historial de ventas
          <span className="ml-2 text-gray-600">({sales.length})</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel">
              {["Producto", "Fecha", "Cant.", "Importe", "Método", "Registrado por", ""].map((h) => (
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
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-hover transition-colors duration-200">
                <td className="px-4 py-3 text-white font-heading font-bold">{s.productDescription}</td>
                <td className="px-4 py-3 text-gray-400 font-body text-xs">{formatDateDisplay(s.soldAt)}</td>
                <td className="px-4 py-3 text-gray-400 font-body text-xs tabular-nums">{s.quantity}</td>
                <td className="px-4 py-3 text-white font-heading font-bold tabular-nums">
                  ${s.totalAmount.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-gray-400 font-body text-xs">{METHOD_LABEL[s.paymentMethod]}</td>
                <td className="px-4 py-3 text-gray-500 font-body text-xs">{s.recordedByName}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditSale(s)}>
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(s);
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

      {editSale && <EditSaleDialog sale={editSale} onClose={() => setEditSale(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar venta"
        message={
          deleteTarget
            ? `¿Eliminar la venta de "${deleteTarget.productDescription}" del ${formatDateDisplay(deleteTarget.soldAt)}? No repone el stock descontado.`
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
