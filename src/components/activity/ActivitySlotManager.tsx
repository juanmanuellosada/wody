"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createActivitySlot, updateActivitySlot, deactivateActivitySlot } from "@/actions/activity";
import { DAY_NAMES, formatMinutes, parseTimeToMinutes } from "@/components/activity/format";

export interface SlotRow {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  capacity: number | null;
  active: boolean;
}

interface Props {
  activityId: string;
  slots: SlotRow[];
}

const EMPTY_FORM = { dayOfWeek: 1, startTime: "09:00", endTime: "10:00", capacity: "" };

export function ActivitySlotManager({ activityId, slots: initial }: Props) {
  const [slots, setSlots] = useState(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startCreate() {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setError(null);
  }

  function startEdit(slot: SlotRow) {
    setEditingId(slot.id);
    setForm({
      dayOfWeek: slot.dayOfWeek,
      startTime: formatMinutes(slot.startMinute),
      endTime: formatMinutes(slot.endMinute),
      capacity: slot.capacity !== null ? String(slot.capacity) : "",
    });
    setError(null);
  }

  function handleSave() {
    const startMinute = parseTimeToMinutes(form.startTime);
    const endMinute = parseTimeToMinutes(form.endTime);
    if (startMinute === null || endMinute === null) {
      setError("Los horarios no son válidos.");
      return;
    }
    if (endMinute <= startMinute) {
      setError("La hora de fin debe ser posterior a la de inicio.");
      return;
    }
    let parsedCapacity: number | null = null;
    if (form.capacity.trim() !== "") {
      const n = parseInt(form.capacity, 10);
      if (isNaN(n) || n <= 0) {
        setError("El cupo debe ser un número entero positivo, o vacío para sin límite.");
        return;
      }
      parsedCapacity = n;
    }

    setError(null);
    const input = { dayOfWeek: form.dayOfWeek, startMinute, endMinute, capacity: parsedCapacity };
    const currentEditingId = editingId;

    startTransition(async () => {
      const result =
        currentEditingId === "new"
          ? await createActivitySlot(activityId, input)
          : await updateActivitySlot(currentEditingId as string, input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSlots((prev) =>
        currentEditingId === "new"
          ? [...prev, result.slot]
          : prev.map((s) => (s.id === result.slot.id ? result.slot : s))
      );
      setEditingId(null);
    });
  }

  function handleDeactivate(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await deactivateActivitySlot(id);
      if (!result.success) {
        setError(result.error);
      } else {
        setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, active: false } : s)));
      }
      setBusyId(null);
    });
  }

  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Horarios
          <span className="ml-2 text-gray-600">({slots.length})</span>
        </p>
        <Button variant="primary" size="sm" onClick={startCreate}>
          Agregar horario
        </Button>
      </div>

      {slots.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic">Todavía no hay horarios cargados.</p>
      ) : (
        <ul className="divide-y divide-line">
          {slots.map((s) => (
            <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-white font-heading font-bold text-sm">
                  {DAY_NAMES[s.dayOfWeek]} {formatMinutes(s.startMinute)}–{formatMinutes(s.endMinute)}
                </p>
                <p className="text-gray-500 text-xs font-body">
                  {s.capacity === null ? "Sin límite de cupo" : `Cupo: ${s.capacity}`}
                  {!s.active && <span className="ml-2 text-brand-red">· Desactivado</span>}
                </p>
              </div>
              {s.active && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={isPending && busyId === s.id}
                    onClick={() => handleDeactivate(s.id)}
                  >
                    Desactivar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && !editingId && (
        <p className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      {editingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={(e) => e.target === e.currentTarget && !isPending && setEditingId(null)}
        >
          <div className="bg-panel border border-edge p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
            <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              {editingId === "new" ? "Nuevo horario" : "Editar horario"}
            </h3>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                  Día
                </label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                  disabled={isPending}
                  className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={i} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                    Inicio
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    disabled={isPending}
                    className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    disabled={isPending}
                    className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                  Cupo (vacío = sin límite)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  disabled={isPending}
                  placeholder="Sin límite"
                  className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={isPending}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} loading={isPending}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
