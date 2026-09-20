"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TimePicker } from "@/components/ui/TimePicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { DAY_NAMES, parseTimeToMinutes } from "@/components/activity/format";
import { toInputDate } from "@/lib/dates";
import type {
  ActivityActionResult,
  ActivityRow,
  ActivityScheduleKind,
  SlotInput,
  TeacherOption,
} from "./view-models";

type ActivityInput = Omit<
  ActivityRow,
  "id" | "teacherName" | "active" | "teacherId"
> & { teacherId?: string | null };

export type ActivityDialogViewProps = {
  activity?: ActivityRow;
  activitySlotDays?: number[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
  onClose: () => void;
  onSaved: (activity: ActivityRow, slots?: SlotInput[]) => void;
  onCreate: (
    input: ActivityInput,
    slots: SlotInput[],
  ) => Promise<ActivityActionResult>;
  onUpdate: (
    activityId: string,
    input: ActivityInput,
  ) => Promise<ActivityActionResult>;
};

type SlotDraft = {
  dayOfWeek: number;
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
};
const newSlotDraft = (): SlotDraft => ({
  dayOfWeek: 1,
  date: toInputDate(new Date()),
  startTime: "09:00",
  endTime: "10:00",
  capacity: "",
});
const uniqueSortedDays = (days: number[]) =>
  [...new Set(days)].sort((a, b) => a - b);
const formatDayNames = (days: number[]) => {
  const names = days.map((day) => DAY_NAMES[day]);
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
};
const weekdayOfYMD = (ymd: string) =>
  new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
function nextDateOnDays(days: number[]): string | null {
  const set = new Set(days);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  for (let index = 0; index < 7; index += 1) {
    if (set.has(date.getDay()))
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    date.setDate(date.getDate() + 1);
  }
  return null;
}
function overlaps(a: SlotDraft, b: SlotDraft, kind: ActivityScheduleKind) {
  if (kind === "WEEKLY" ? a.dayOfWeek !== b.dayOfWeek : a.date !== b.date)
    return false;
  const aStart = parseTimeToMinutes(a.startTime),
    aEnd = parseTimeToMinutes(a.endTime),
    bStart = parseTimeToMinutes(b.startTime),
    bEnd = parseTimeToMinutes(b.endTime);
  return (
    aStart !== null &&
    aEnd !== null &&
    bStart !== null &&
    bEnd !== null &&
    aStart < bEnd &&
    bStart < aEnd
  );
}

export function ActivityDialogView({
  activity,
  activitySlotDays = [],
  teachers,
  canAssignTeacher,
  onClose,
  onSaved,
  onCreate,
  onUpdate,
}: ActivityDialogViewProps) {
  const isEdit = !!activity;
  const [name, setName] = useState(activity?.name ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [teacherId, setTeacherId] = useState(activity?.teacherId ?? "");
  const [scheduleKind, setScheduleKind] = useState<ActivityScheduleKind>(
    activity?.scheduleKind ?? "WEEKLY",
  );
  const [allowsRecurring, setAllowsRecurring] = useState(
    activity?.allowsRecurring ?? true,
  );
  const [cancelWindowHours, setCancelWindowHours] = useState(
    String(activity?.cancelWindowHours ?? 2),
  );
  const [capacity, setCapacity] = useState(
    activity?.capacity != null ? String(activity.capacity) : "",
  );
  const [slotDrafts, setSlotDrafts] = useState<SlotDraft[]>(
    isEdit ? [] : [newSlotDraft()],
  );
  const [startsOn, setStartsOn] = useState(
    activity?.startsOn ??
      nextDateOnDays(
        isEdit ? activitySlotDays : slotDrafts.map((slot) => slot.dayOfWeek),
      ) ??
      "",
  );
  const [startsOnTouched, setStartsOnTouched] = useState(isEdit);
  const [hasEndDate, setHasEndDate] = useState(activity?.endsOn != null);
  const [endsOn, setEndsOn] = useState(
    activity?.endsOn ?? activity?.startsOn ?? toInputDate(new Date()),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedDays =
    scheduleKind === "WEEKLY"
      ? uniqueSortedDays(
          isEdit ? activitySlotDays : slotDrafts.map((slot) => slot.dayOfWeek),
        )
      : [];
  const startsOnMismatch =
    scheduleKind === "WEEKLY" &&
    startsOn !== "" &&
    selectedDays.length > 0 &&
    !selectedDays.includes(weekdayOfYMD(startsOn));
  function syncStartsOn(kind: ActivityScheduleKind, days: number[]) {
    if (kind === "WEEKLY" && !startsOnTouched)
      setStartsOn(nextDateOnDays(days) ?? "");
  }
  function patchSlot(index: number, patch: Partial<SlotDraft>) {
    const next = slotDrafts.map((slot, current) =>
      current === index ? { ...slot, ...patch } : slot,
    );
    setSlotDrafts(next);
    syncStartsOn(
      scheduleKind,
      uniqueSortedDays(next.map((slot) => slot.dayOfWeek)),
    );
  }
  function confirm() {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    const windowHours = Number(cancelWindowHours);
    if (!Number.isInteger(windowHours) || windowHours < 0)
      return setError(
        "La ventana de cancelación debe ser un número mayor o igual a cero.",
      );
    const parsedCapacity = capacity.trim() === "" ? null : Number(capacity);
    if (
      parsedCapacity !== null &&
      (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0)
    )
      return setError(
        "El cupo debe ser un número entero positivo, o vacío para sin límite.",
      );
    if (scheduleKind === "WEEKLY") {
      if (!startsOn)
        return setError("La fecha de inicio de vigencia es obligatoria.");
      if (hasEndDate && endsOn < startsOn)
        return setError(
          "La fecha de fin de vigencia debe ser posterior o igual a la de inicio.",
        );
      if (
        selectedDays.length > 0 &&
        !selectedDays.includes(weekdayOfYMD(startsOn))
      )
        return setError(
          `La fecha de inicio debe caer en uno de los días con horario: ${formatDayNames(selectedDays)}.`,
        );
    }
    const slots: SlotInput[] = [];
    if (!isEdit) {
      if (!slotDrafts.length) return setError("Agregá al menos un horario.");
      for (const slot of slotDrafts) {
        const startMinute = parseTimeToMinutes(slot.startTime),
          endMinute = parseTimeToMinutes(slot.endTime),
          slotCapacity =
            slot.capacity.trim() === "" ? null : Number(slot.capacity);
        if (startMinute === null || endMinute === null)
          return setError("Los horarios no son válidos.");
        if (endMinute <= startMinute)
          return setError("La hora de fin debe ser posterior a la de inicio.");
        if (
          slotCapacity !== null &&
          (!Number.isInteger(slotCapacity) || slotCapacity <= 0)
        )
          return setError(
            "El cupo del horario debe ser un número entero positivo, o vacío para sin límite.",
          );
        slots.push({
          dayOfWeek: scheduleKind === "WEEKLY" ? slot.dayOfWeek : null,
          date: scheduleKind === "ONE_OFF" ? slot.date : null,
          startMinute,
          endMinute,
          capacity: slotCapacity,
        });
      }
      for (let first = 0; first < slotDrafts.length; first += 1)
        for (let second = first + 1; second < slotDrafts.length; second += 1)
          if (overlaps(slotDrafts[first], slotDrafts[second], scheduleKind))
            return setError("Hay horarios superpuestos.");
    }
    const input = {
      name: name.trim(),
      description: description.trim() || null,
      teacherId: canAssignTeacher ? teacherId || null : undefined,
      scheduleKind,
      allowsRecurring,
      cancelWindowHours: windowHours,
      capacity: parsedCapacity,
      startsOn: scheduleKind === "WEEKLY" ? startsOn : null,
      endsOn: scheduleKind === "WEEKLY" && hasEndDate ? endsOn : null,
    };
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await onUpdate(activity.id, input)
        : await onCreate(input, slots);
      if (!result.success) return setError(result.error);
      onSaved(result.activity, isEdit ? undefined : slots);
    });
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(event) =>
        event.target === event.currentTarget && !isPending && onClose()
      }
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          {isEdit ? "Editar actividad" : "Nueva actividad"}
        </h3>
        <div className="flex flex-col gap-3">
          <Field label="Nombre">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isPending}
              autoFocus
              placeholder="Ej: Crossfit intermedio"
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
            />
          </Field>
          <Field label="Descripción">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isPending}
              rows={2}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </Field>
          <Field label="Ventana de cancelación (hs)">
            <input
              type="number"
              min={0}
              step={1}
              value={cancelWindowHours}
              onChange={(event) => setCancelWindowHours(event.target.value)}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </Field>
          <Field label="Cupo por defecto (vacío = sin límite)">
            <input
              type="number"
              min={1}
              step={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              disabled={isPending}
              placeholder="Sin límite"
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
            />
            <p className="text-xs text-gray-500 font-body mt-1">
              Se usa en los horarios que no tengan su propio cupo.
            </p>
          </Field>
          {canAssignTeacher && (
            <Field label="Profe a cargo">
              <select
                value={teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
                disabled={isPending}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              >
                <option value="">Sin profe asignado</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!isEdit && (
            <Field label="Modo de agenda">
              <select
                value={scheduleKind}
                onChange={(event) => {
                  const kind = event.target.value as ActivityScheduleKind;
                  setScheduleKind(kind);
                  syncStartsOn(
                    kind,
                    uniqueSortedDays(slotDrafts.map((slot) => slot.dayOfWeek)),
                  );
                }}
                disabled={isPending}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              >
                <option value="WEEKLY">Recurrente semanal</option>
                <option value="ONE_OFF">Fecha única</option>
              </select>
              <p className="text-xs text-gray-500 font-body mt-1">
                No se puede cambiar después de creada la actividad.
              </p>
            </Field>
          )}
          {scheduleKind === "WEEKLY" && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <DatePicker
                    label="Se repite a partir de"
                    value={startsOn}
                    onChange={(value) => {
                      setStartsOn(value);
                      setStartsOnTouched(true);
                    }}
                    disabled={isPending || selectedDays.length === 0}
                  />
                  <p
                    className={`text-xs font-body mt-1 ${startsOnMismatch ? "text-brand-red font-bold uppercase tracking-wide" : "text-gray-500"}`}
                  >
                    {selectedDays.length === 0
                      ? "Agregá al menos un horario para poder elegir la fecha de inicio."
                      : startsOnMismatch
                        ? `No coincide con ningún horario cargado. Válido: ${formatDayNames(selectedDays)}.`
                        : `Válido: ${formatDayNames(selectedDays)}.`}
                  </p>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hasEndDate}
                      onChange={(event) => setHasEndDate(!event.target.checked)}
                      disabled={isPending}
                    />
                    Sin fecha de fin
                  </label>
                  {hasEndDate && (
                    <DatePicker
                      label="Hasta"
                      value={endsOn}
                      onChange={setEndsOn}
                      disabled={isPending}
                    />
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-body text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowsRecurring}
                  onChange={(event) => setAllowsRecurring(event.target.checked)}
                  disabled={isPending}
                />
                Admite inscripción recurrente (&quot;todos los lunes&quot;)
              </label>
            </>
          )}
        </div>
        {!isEdit && (
          <div className="flex flex-col gap-3 border-t border-edge pt-4">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
                Horarios
              </p>
              <p className="text-xs text-gray-500 font-body mt-1">
                {scheduleKind === "WEEKLY"
                  ? "Cada horario se repite todas las semanas. Se pueden ajustar después desde la actividad."
                  : "Cada horario ocurre una única vez, en la fecha indicada. Se pueden ajustar después desde la actividad."}
              </p>
            </div>
            {slotDrafts.map((slot, index) => (
              <div key={index} className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[110px]">
                  {scheduleKind === "WEEKLY" ? (
                    <Field label="Día">
                      <select
                        value={slot.dayOfWeek}
                        onChange={(event) =>
                          patchSlot(index, {
                            dayOfWeek: Number(event.target.value),
                          })
                        }
                        disabled={isPending}
                        className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                      >
                        {DAY_NAMES.map((day, dayIndex) => (
                          <option key={dayIndex} value={dayIndex}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <DatePicker
                      label="Fecha"
                      value={slot.date}
                      onChange={(value) => patchSlot(index, { date: value })}
                      disabled={isPending}
                    />
                  )}
                </div>
                <div className="min-w-[110px]">
                  <TimePicker
                    label="Inicio"
                    value={slot.startTime}
                    onChange={(value) => patchSlot(index, { startTime: value })}
                    disabled={isPending}
                  />
                </div>
                <div className="min-w-[110px]">
                  <TimePicker
                    label="Fin"
                    value={slot.endTime}
                    onChange={(value) => patchSlot(index, { endTime: value })}
                    disabled={isPending}
                  />
                </div>
                <div className="min-w-[90px]">
                  <Field label="Cupo">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={slot.capacity}
                      onChange={(event) =>
                        patchSlot(index, { capacity: event.target.value })
                      }
                      disabled={isPending}
                      placeholder="Sin límite"
                      className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
                    />
                  </Field>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = slotDrafts.filter(
                      (_, current) => current !== index,
                    );
                    setSlotDrafts(next);
                    syncStartsOn(
                      scheduleKind,
                      uniqueSortedDays(next.map((item) => item.dayOfWeek)),
                    );
                  }}
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
              onClick={() => {
                const next = [...slotDrafts, newSlotDraft()];
                setSlotDrafts(next);
                syncStartsOn(
                  scheduleKind,
                  uniqueSortedDays(next.map((slot) => slot.dayOfWeek)),
                );
              }}
              disabled={isPending}
              className="self-start"
            >
              Agregar horario
            </Button>
          </div>
        )}
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
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={confirm}
            loading={isPending}
          >
            Guardar
          </Button>
        </div>
      </div>
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
