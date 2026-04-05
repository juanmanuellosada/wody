"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { copyWod } from "@/actions/wod";
import { toInputDate } from "@/lib/dates";

interface Student {
  id: string;
  name: string;
}

interface CopyWodDialogProps {
  wodId: string;
  currentStudentId: string;
  students: Student[];
  onClose: () => void;
}

export function CopyWodDialog({
  wodId,
  currentStudentId,
  students,
  onClose,
}: CopyWodDialogProps) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [targetStudentId, setTargetStudentId] = useState(currentStudentId);
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
      const result = await copyWod(wodId, targetStudentId, targetDate);
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

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Alumno destino
            </label>
            <select
              value={targetStudentId}
              onChange={(e) => setTargetStudentId(e.target.value)}
              disabled={isPending}
              className="bg-[#1A1A1A] text-white font-body border border-[#2A2A2A] px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-[#E31414] focus:ring-1 focus:ring-[#E31414]/20 transition-all duration-200 disabled:opacity-50"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <DatePicker
            label="Fecha destino"
            value={targetDate}
            onChange={setTargetDate}
            disabled={isPending}
          />
        </div>

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
