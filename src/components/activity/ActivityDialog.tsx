"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createActivity, updateActivity, type ActivityRow } from "@/actions/activity";

export type { ActivityRow };

export interface TeacherOption {
  id: string;
  name: string;
}

interface Props {
  /** Presente = modo edición. */
  activity?: ActivityRow;
  teachers: TeacherOption[];
  /** false para TEACHER: siempre queda a cargo de sí mismo, no elige. */
  canAssignTeacher: boolean;
  onClose: () => void;
  onSaved: (activity: ActivityRow) => void;
}

export function ActivityDialog({ activity, teachers, canAssignTeacher, onClose, onSaved }: Props) {
  const isEdit = !!activity;
  const [name, setName] = useState(activity?.name ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [color, setColor] = useState(activity?.color ?? "#E31414");
  const [teacherId, setTeacherId] = useState(activity?.teacherId ?? "");
  const [allowsRecurring, setAllowsRecurring] = useState(activity?.allowsRecurring ?? true);
  const [cancelWindowHours, setCancelWindowHours] = useState(String(activity?.cancelWindowHours ?? 2));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const parsedWindow = parseInt(cancelWindowHours, 10);
    if (cancelWindowHours.trim() === "" || isNaN(parsedWindow) || parsedWindow < 0) {
      setError("La ventana de cancelación debe ser un número mayor o igual a cero.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        color: color || null,
        teacherId: canAssignTeacher ? teacherId || null : undefined,
        allowsRecurring,
        cancelWindowHours: parsedWindow,
      };
      const result = isEdit ? await updateActivity(activity!.id, input) : await createActivity(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.activity);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          {isEdit ? "Editar actividad" : "Nueva actividad"}
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
              placeholder="Ej: Crossfit intermedio"
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              rows={2}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Color
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={isPending}
                className="w-full h-10 bg-elev border border-edge cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Ventana de cancelación (hs)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={cancelWindowHours}
                onChange={(e) => setCancelWindowHours(e.target.value)}
                disabled={isPending}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              />
            </div>
          </div>

          {canAssignTeacher && (
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Profe a cargo
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                disabled={isPending}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              >
                <option value="">Sin profe asignado</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-body text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allowsRecurring}
              onChange={(e) => setAllowsRecurring(e.target.checked)}
              disabled={isPending}
            />
            Admite inscripción recurrente (&quot;todos los lunes&quot;)
          </label>
        </div>

        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
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
