"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { copyWod } from "@/actions/wod";
import { toInputDate } from "@/lib/dates";

interface CopyWodDialogProps {
  wodId: string;
  onClose: () => void;
}

export function CopyWodDialog({ wodId, onClose }: CopyWodDialogProps) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [targetDate, setTargetDate] = useState(toInputDate(tomorrow));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleConfirm() {
    setError(null);

    if (!targetDate) {
      setError("Selecciona una fecha.");
      return;
    }

    startTransition(async () => {
      const result = await copyWod(wodId, targetDate);
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm bg-[#0A0A0A] border border-[#1A1A1A] p-6 flex flex-col gap-5"
        role="dialog"
        aria-modal="true"
        aria-label="Copiar WOD"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
            Copiar WOD
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Cerrar"
          >
            &#215;
          </button>
        </div>

        <DatePicker
          label="Fecha destino"
          value={targetDate}
          onChange={setTargetDate}
          disabled={isPending}
        />

        {error && (
          <p className="text-xs font-heading font-bold text-[#E31414] uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            onClick={handleConfirm}
            className="flex-1"
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
