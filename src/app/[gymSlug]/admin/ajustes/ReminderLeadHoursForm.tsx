"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { updateReminderLeadHours } from "@/actions/gym-settings";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  currentHours: number;
}

export function ReminderLeadHoursForm({ currentHours }: Props) {
  const [hours, setHours] = useState(String(currentHours));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError(null);
    setSuccess(false);
    const parsed = Number(hours);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 72) {
      setError("Ingresá un número entero de horas entre 1 y 72.");
      return;
    }
    startTransition(async () => {
      const result = await updateReminderLeadHours(parsed);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Antelación (horas)"
        type="number"
        min={1}
        max={72}
        value={hours}
        onChange={(e) => {
          setHours(e.target.value);
          setSuccess(false);
        }}
        disabled={isPending}
      />

      {error && (
        <div className="flex items-start gap-2.5 border border-brand-red/30 bg-brand-red/5 px-4 py-3">
          <AlertTriangle size={14} className="text-brand-red flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-brand-red font-body">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs text-emerald-400 font-body">Guardado.</p>
        </div>
      )}

      <Button onClick={handleSave} disabled={isPending} loading={isPending}>
        Guardar
      </Button>
    </div>
  );
}
