"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TimePicker } from "@/components/ui/TimePicker";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  DAY_NAMES,
  formatMinutes,
  formatSlotSchedule,
  parseTimeToMinutes,
} from "@/components/activity/format";
import { toInputDate } from "@/lib/dates";
import type {
  ActivityScheduleKind,
  SlotActionResult,
  SlotInput,
  SlotRow,
} from "./view-models";

type Props = {
  scheduleKind: ActivityScheduleKind;
  slots: SlotRow[];
  onCreate: (input: SlotInput) => Promise<SlotActionResult>;
  onUpdate: (slotId: string, input: SlotInput) => Promise<SlotActionResult>;
  onDeactivate: (
    slotId: string,
  ) => Promise<{ success: true } | { success: false; error: string }>;
};
type Form = {
  dayOfWeek: number;
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
};
const emptyForm = (): Form => ({
  dayOfWeek: 1,
  date: toInputDate(new Date()),
  startTime: "09:00",
  endTime: "10:00",
  capacity: "",
});

export function ActivitySlotManagerView({
  scheduleKind,
  slots: initial,
  onCreate,
  onUpdate,
  onDeactivate,
}: Props) {
  const [slots, setSlots] = useState(initial),
    [editingId, setEditingId] = useState<string | "new" | null>(null),
    [form, setForm] = useState(emptyForm),
    [error, setError] = useState<string | null>(null),
    [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function edit(slot: SlotRow) {
    setEditingId(slot.id);
    setForm({
      dayOfWeek: slot.dayOfWeek ?? 1,
      date: slot.date ?? toInputDate(new Date()),
      startTime: formatMinutes(slot.startMinute),
      endTime: formatMinutes(slot.endMinute),
      capacity: slot.capacity === null ? "" : String(slot.capacity),
    });
    setError(null);
  }
  function save() {
    const startMinute = parseTimeToMinutes(form.startTime),
      endMinute = parseTimeToMinutes(form.endTime),
      capacity = form.capacity.trim() === "" ? null : Number(form.capacity);
    if (startMinute === null || endMinute === null)
      return setError("Los horarios no son válidos.");
    if (endMinute <= startMinute)
      return setError("La hora de fin debe ser posterior a la de inicio.");
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0))
      return setError(
        "El cupo debe ser un número entero positivo, o vacío para sin límite.",
      );
    const input = {
      dayOfWeek: scheduleKind === "WEEKLY" ? form.dayOfWeek : null,
      date: scheduleKind === "ONE_OFF" ? form.date : null,
      startMinute,
      endMinute,
      capacity,
    };
    const current = editingId;
    setError(null);
    startTransition(async () => {
      const result =
        current === "new"
          ? await onCreate(input)
          : await onUpdate(current as string, input);
      if (!result.success) return setError(result.error);
      setSlots((rows) =>
        current === "new"
          ? [...rows, result.slot]
          : rows.map((row) => (row.id === result.slot.id ? result.slot : row)),
      );
      setEditingId(null);
    });
  }
  function deactivate(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await onDeactivate(id);
      if (!result.success) setError(result.error);
      else
        setSlots((rows) =>
          rows.map((row) => (row.id === id ? { ...row, active: false } : row)),
        );
      setBusyId(null);
    });
  }
  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Horarios<span className="ml-2 text-gray-600">({slots.length})</span>
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditingId("new");
            setForm(emptyForm());
            setError(null);
          }}
        >
          Agregar horario
        </Button>
      </div>
      {slots.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic">
          Todavía no hay horarios cargados.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {slots.map((slot) => (
            <li
              key={slot.id}
              className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div>
                <p className="text-white font-heading font-bold text-sm">
                  {formatSlotSchedule(slot)} {formatMinutes(slot.startMinute)}–
                  {formatMinutes(slot.endMinute)}
                </p>
                <p className="text-gray-500 text-xs font-body">
                  {slot.capacity === null
                    ? "Sin límite de cupo"
                    : `Cupo: ${slot.capacity}`}
                  {!slot.active && (
                    <span className="ml-2 text-brand-red">· Desactivado</span>
                  )}
                </p>
              </div>
              {slot.active && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => edit(slot)}>
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={isPending && busyId === slot.id}
                    onClick={() => deactivate(slot.id)}
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
        <p
          className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
          role="alert"
        >
          {error}
        </p>
      )}
      {editingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={(event) =>
            event.target === event.currentTarget &&
            !isPending &&
            setEditingId(null)
          }
        >
          <div className="bg-panel border border-edge p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
            <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              {editingId === "new" ? "Nuevo horario" : "Editar horario"}
            </h3>
            <div className="flex flex-col gap-3">
              {scheduleKind === "WEEKLY" ? (
                <Field label="Día">
                  <select
                    value={form.dayOfWeek}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        dayOfWeek: Number(event.target.value),
                      }))
                    }
                    disabled={isPending}
                    className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                  >
                    {DAY_NAMES.map((name, index) => (
                      <option key={index} value={index}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <DatePicker
                  label="Fecha"
                  value={form.date}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, date: value }))
                  }
                  disabled={isPending}
                />
              )}
              <div className="flex gap-3">
                <div className="flex-1">
                  <TimePicker
                    label="Inicio"
                    value={form.startTime}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, startTime: value }))
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="flex-1">
                  <TimePicker
                    label="Fin"
                    value={form.endTime}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, endTime: value }))
                    }
                    disabled={isPending}
                  />
                </div>
              </div>
              <Field label="Cupo (vacío = sin límite)">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.capacity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      capacity: event.target.value,
                    }))
                  }
                  disabled={isPending}
                  placeholder="Sin límite"
                  className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
                />
              </Field>
            </div>
            {error && (
              <p
                className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingId(null)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={save}
                loading={isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
