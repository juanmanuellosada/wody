"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { registerExpense } from "@/actions/expense";

interface Props {
  open: boolean;
  onClose: () => void;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function DialogForm({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [spentAt, setSpentAt] = useState(todayUTC());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validate(): { ok: false } | { ok: true; parsedAmount: number } {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("El importe debe ser mayor a cero.");
      return { ok: false };
    }
    if (!description.trim()) {
      setError("La descripción es obligatoria.");
      return { ok: false };
    }
    if (!spentAt) {
      setError("Ingresá la fecha del gasto.");
      return { ok: false };
    }
    return { ok: true, parsedAmount };
  }

  function handleConfirm() {
    const v = validate();
    if (!v.ok) return;
    setError(null);
    startTransition(async () => {
      const result = await registerExpense(v.parsedAmount, description, { spentAtStr: spentAt });
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
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Registrar gasto
        </h3>

        <div className="flex flex-col gap-3">
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
                placeholder="Ej: 15000"
                autoFocus
                className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
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
              placeholder="Ej: Compra de artículos de limpieza"
              rows={3}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600 resize-none"
            />
          </div>

          <DatePicker
            value={spentAt}
            onChange={(d) => {
              const today = todayUTC();
              if (d > today) return; // silently block future dates
              setSpentAt(d);
            }}
            disabled={isPending}
            label="Fecha del gasto"
            max={todayUTC()}
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

export function RegisterExpenseDialog({ open, onClose }: Props) {
  if (!open) return null;
  return <DialogForm onClose={onClose} />;
}
