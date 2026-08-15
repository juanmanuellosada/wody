"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createActivity, updateActivity, type ActivityRow, type SlotInput } from "@/actions/activity";
import { DAY_NAMES, parseTimeToMinutes } from "@/components/activity/format";

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

interface SlotDraft {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: string;
}

function newSlotDraft(): SlotDraft {
  return { dayOfWeek: 1, startTime: "09:00", endTime: "10:00", capacity: "" };
}

export function ActivityDialog({ activity, teachers, canAssignTeacher, onClose, onSaved }: Props) {
  const isEdit = !!activity;
  const [name, setName] = useState(activity?.name ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [color, setColor] = useState(activity?.color ?? "#E31414");
  const [teacherId, setTeacherId] = useState(activity?.teacherId ?? "");
  const [allowsRecurring, setAllowsRecurring] = useState(activity?.allowsRecurring ?? true);
  const [cancelWindowHours, setCancelWindowHours] = useState(String(activity?.cancelWindowHours ?? 2));
  const [capacity, setCapacity] = useState(activity?.capacity != null ? String(activity.capacity) : "");
  const [slotDrafts, setSlotDrafts] = useState<SlotDraft[]>(isEdit ? [] : [newSlotDraft()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSlotDraft(index: number, patch: Partial<SlotDraft>) {
    setSlotDrafts((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSlotDraft(index: number) {
    setSlotDrafts((prev) => prev.filter((_, i) => i !== index));
  }

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
    let parsedCapacity: number | null = null;
    if (capacity.trim() !== "") {
      const n = parseInt(capacity, 10);
      if (isNaN(n) || n <= 0) {
        setError("El cupo debe ser un número entero positivo, o vacío para sin límite.");
        return;
      }
      parsedCapacity = n;
    }

    let slots: SlotInput[] = [];
    if (!isEdit) {
      if (slotDrafts.length === 0) {
        setError("Agregá al menos un horario.");
        return;
      }
      slots = [];
      for (const draft of slotDrafts) {
        const startMinute = parseTimeToMinutes(draft.startTime);
        const endMinute = parseTimeToMinutes(draft.endTime);
        if (startMinute === null || endMinute === null) {
          setError("Los horarios no son válidos.");
          return;
        }
        if (endMinute <= startMinute) {
          setError("La hora de fin debe ser posterior a la de inicio.");
          return;
        }
        let slotCapacity: number | null = null;
        if (draft.capacity.trim() !== "") {
          const n = parseInt(draft.capacity, 10);
          if (isNaN(n) || n <= 0) {
            setError("El cupo del horario debe ser un número entero positivo, o vacío para sin límite.");
            return;
          }
          slotCapacity = n;
        }
        slots.push({ dayOfWeek: draft.dayOfWeek, startMinute, endMinute, capacity: slotCapacity });
      }
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i];
          const b = slots[j];
          if (a.dayOfWeek === b.dayOfWeek && a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
            setError("Hay horarios superpuestos el mismo día.");
            return;
          }
        }
      }
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
        capacity: parsedCapacity,
      };
      const result = isEdit ? await updateActivity(activity!.id, input) : await createActivity(input, slots);
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
      <div className="bg-panel border border-edge p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto flex flex-col gap-4">
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

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Cupo por defecto (vacío = sin límite)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              disabled={isPending}
              placeholder="Sin límite"
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
            />
            <p className="text-xs text-gray-500 font-body mt-1">
              Se usa en los horarios que no tengan su propio cupo.
            </p>
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

        {!isEdit && (
          <div className="flex flex-col gap-3 border-t border-edge pt-4">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
                Horarios
              </p>
              <p className="text-xs text-gray-500 font-body mt-1">
                Cada horario se repite todas las semanas. Se pueden ajustar después desde la actividad.
              </p>
            </div>

            {slotDrafts.map((draft, i) => (
              <div key={i} className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[110px]">
                  <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                    Día
                  </label>
                  <select
                    value={draft.dayOfWeek}
                    onChange={(e) => updateSlotDraft(i, { dayOfWeek: Number(e.target.value) })}
                    disabled={isPending}
                    className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                  >
                    {DAY_NAMES.map((dayName, idx) => (
                      <option key={idx} value={idx}>
                        {dayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[90px]">
                  <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                    Inicio
                  </label>
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(e) => updateSlotDraft(i, { startTime: e.target.value })}
                    disabled={isPending}
                    className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                  />
                </div>
                <div className="min-w-[90px]">
                  <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(e) => updateSlotDraft(i, { endTime: e.target.value })}
                    disabled={isPending}
                    className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                  />
                </div>
                <div className="min-w-[90px]">
                  <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                    Cupo
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={draft.capacity}
                    onChange={(e) => updateSlotDraft(i, { capacity: e.target.value })}
                    disabled={isPending}
                    placeholder="Sin límite"
                    className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSlotDraft(i)}
                  disabled={isPending}
                  aria-label="Quitar horario"
                >
                  Quitar
                </Button>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSlotDrafts((prev) => [...prev, newSlotDraft()])}
              disabled={isPending}
              className="self-start"
            >
              Agregar horario
            </Button>
          </div>
        )}

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
