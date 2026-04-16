"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { createRm, updateRm } from "@/actions/rm";
import { toInputDate } from "@/lib/dates";

interface RmFormProps {
  editId?: string;
  defaultExercise?: string;
  defaultWeight?: number;
  defaultDate?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
}

export function RmForm({
  editId,
  defaultExercise = "",
  defaultWeight,
  defaultDate,
  onCancel,
  onSuccess,
}: RmFormProps) {
  const todayStr = toInputDate(new Date());
  const [date, setDate] = useState(defaultDate ?? todayStr);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isEditing = !!editId;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("date", date);

    startTransition(async () => {
      const result = isEditing
        ? await updateRm(editId, formData)
        : await createRm(formData);

      if (result.success) {
        setSuccess(true);
        if (!isEditing) form.reset();
        onSuccess?.();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 bg-[#0A0A0A] border border-[#1A1A1A] p-5"
    >
      <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
        {isEditing ? "Editar RM" : "Agregar RM"}
      </h3>

      <Input
        name="exercise"
        label="Ejercicio"
        placeholder="Ej: Back Squat, Deadlift..."
        defaultValue={defaultExercise}
        required
        disabled={isPending}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          name="weight"
          label="Peso (kg)"
          type="number"
          step="any"
          min="0.1"
          placeholder="Ej: 100"
          defaultValue={defaultWeight}
          required
          disabled={isPending}
        />

        <DatePicker
          label="Fecha"
          value={date}
          onChange={setDate}
          disabled={isPending}
        />
      </div>

      {error && (
        <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      {success && !isEditing && (
        <p className="text-xs font-heading font-bold text-green-500 uppercase tracking-wide" role="status">
          RM guardado correctamente.
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={isPending} size="md">
          {isEditing ? "Actualizar" : "Guardar RM"}
        </Button>
      </div>
    </form>
  );
}
