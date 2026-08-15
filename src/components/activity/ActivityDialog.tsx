"use client";

import { useState, useTransition } from "react";
import type { ActivityScheduleKind } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { TimePicker } from "@/components/ui/TimePicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { createActivity, updateActivity, type ActivityRow, type SlotInput } from "@/actions/activity";
import { DAY_NAMES, parseTimeToMinutes } from "@/components/activity/format";
import { toInputDate } from "@/lib/dates";

export type { ActivityRow };

export interface TeacherOption {
  id: string;
  name: string;
}

interface Props {
  /** Presente = modo edición. */
  activity?: ActivityRow;
  /**
   * Días de la semana (dayOfWeek) de los ActivitySlot activos actuales de la
   * actividad. Solo se usa en modo edición (WEEKLY): esta pantalla no toca
   * horarios, así que el default y la validación de "Se repite a partir de"
   * se apoyan en los días ya cargados. En alta se derivan de `slotDrafts`.
   */
  activitySlotDays?: number[];
  teachers: TeacherOption[];
  /** false para TEACHER: siempre queda a cargo de sí mismo, no elige. */
  canAssignTeacher: boolean;
  onClose: () => void;
  /** `slots` solo viene poblado en el alta (la edición no toca horarios). */
  onSaved: (activity: ActivityRow, slots?: SlotInput[]) => void;
}

interface SlotDraft {
  dayOfWeek: number;
  date: string;
  startTime: string;
  endTime: string;
  capacity: string;
}

function newSlotDraft(): SlotDraft {
  return { dayOfWeek: 1, date: toInputDate(new Date()), startTime: "09:00", endTime: "10:00", capacity: "" };
}

function slotDraftsOverlap(a: SlotDraft, b: SlotDraft, scheduleKind: ActivityScheduleKind): boolean {
  const sameBucket = scheduleKind === "WEEKLY" ? a.dayOfWeek === b.dayOfWeek : a.date === b.date;
  if (!sameBucket) return false;
  const aStart = parseTimeToMinutes(a.startTime);
  const aEnd = parseTimeToMinutes(a.endTime);
  const bStart = parseTimeToMinutes(b.startTime);
  const bEnd = parseTimeToMinutes(b.endTime);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

function uniqueSortedDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

function formatDayNames(days: number[]): string {
  const names = days.map((d) => DAY_NAMES[d]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}

/** "YYYY-MM-DD" en componentes locales (no UTC): evita el corrimiento de día
 * que da `toInputDate` si se le pasa un `new Date()` con hora local. */
function formatLocalYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Próxima fecha (YYYY-MM-DD) a partir de hoy (inclusive) cuyo día de la semana esté en `days`. null si `days` está vacío. */
function nextDateOnDays(days: number[]): string | null {
  if (days.length === 0) return null;
  const daySet = new Set(days);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 7; i++) {
    if (daySet.has(d.getDay())) return formatLocalYMD(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/** Día de la semana (Date.getDay(), 0-6) de una fecha "YYYY-MM-DD" tratada como fecha calendario, no instante. */
function weekdayOfYMD(ymd: string): number {
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

export function ActivityDialog({ activity, activitySlotDays = [], teachers, canAssignTeacher, onClose, onSaved }: Props) {
  const isEdit = !!activity;
  const [name, setName] = useState(activity?.name ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [teacherId, setTeacherId] = useState(activity?.teacherId ?? "");
  const [scheduleKind, setScheduleKind] = useState<ActivityScheduleKind>(activity?.scheduleKind ?? "WEEKLY");
  const [allowsRecurring, setAllowsRecurring] = useState(activity?.allowsRecurring ?? true);
  const [cancelWindowHours, setCancelWindowHours] = useState(String(activity?.cancelWindowHours ?? 2));
  const [capacity, setCapacity] = useState(activity?.capacity != null ? String(activity.capacity) : "");
  const [slotDrafts, setSlotDrafts] = useState<SlotDraft[]>(isEdit ? [] : [newSlotDraft()]);
  // El default ya no es "hoy": es la próxima fecha que cae en alguno de los
  // días elegidos (ver spec "Vigencia de una actividad recurrente"). En
  // edición se apoya en los horarios ya cargados (`activitySlotDays`); en
  // alta, en los `slotDrafts` recién armados.
  const [startsOn, setStartsOn] = useState(
    activity?.startsOn ?? nextDateOnDays(isEdit ? activitySlotDays : slotDrafts.map((s) => s.dayOfWeek)) ?? ""
  );
  // Si el usuario edita la fecha a mano, dejamos de recalcular el default
  // automáticamente. En edición nunca se autocompleta (ya viene guardada).
  const [startsOnTouched, setStartsOnTouched] = useState(isEdit);
  const [hasEndDate, setHasEndDate] = useState(activity?.endsOn != null);
  const [endsOn, setEndsOn] = useState(activity?.endsOn ?? activity?.startsOn ?? toInputDate(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDays =
    scheduleKind === "WEEKLY" ? uniqueSortedDays(isEdit ? activitySlotDays : slotDrafts.map((s) => s.dayOfWeek)) : [];
  const startsOnMismatch =
    scheduleKind === "WEEKLY" &&
    startsOn !== "" &&
    selectedDays.length > 0 &&
    !selectedDays.includes(weekdayOfYMD(startsOn));

  /** Recalcula el default de "Se repite a partir de" si el usuario no lo tocó a mano. */
  function syncStartsOnDefault(kind: ActivityScheduleKind, days: number[]) {
    if (kind !== "WEEKLY" || startsOnTouched) return;
    setStartsOn(nextDateOnDays(days) ?? "");
  }

  function updateSlotDraft(index: number, patch: Partial<SlotDraft>) {
    const next = slotDrafts.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setSlotDrafts(next);
    syncStartsOnDefault(scheduleKind, uniqueSortedDays(next.map((s) => s.dayOfWeek)));
  }

  function removeSlotDraft(index: number) {
    const next = slotDrafts.filter((_, i) => i !== index);
    setSlotDrafts(next);
    syncStartsOnDefault(scheduleKind, uniqueSortedDays(next.map((s) => s.dayOfWeek)));
  }

  function addSlotDraft() {
    const next = [...slotDrafts, newSlotDraft()];
    setSlotDrafts(next);
    syncStartsOnDefault(scheduleKind, uniqueSortedDays(next.map((s) => s.dayOfWeek)));
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

    if (scheduleKind === "WEEKLY") {
      if (!startsOn) {
        setError("La fecha de inicio de vigencia es obligatoria.");
        return;
      }
      if (hasEndDate && endsOn < startsOn) {
        setError("La fecha de fin de vigencia debe ser posterior o igual a la de inicio.");
        return;
      }
      // Espeja la validación del servidor (no la reemplaza): startsOn es la
      // primera clase, así que debe caer en uno de los días con horario.
      if (selectedDays.length > 0 && !selectedDays.includes(weekdayOfYMD(startsOn))) {
        setError(`La fecha de inicio debe caer en uno de los días con horario: ${formatDayNames(selectedDays)}.`);
        return;
      }
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
        slots.push({
          dayOfWeek: scheduleKind === "WEEKLY" ? draft.dayOfWeek : null,
          date: scheduleKind === "ONE_OFF" ? draft.date : null,
          startMinute,
          endMinute,
          capacity: slotCapacity,
        });
      }
      for (let i = 0; i < slotDrafts.length; i++) {
        for (let j = i + 1; j < slotDrafts.length; j++) {
          if (slotDraftsOverlap(slotDrafts[i], slotDrafts[j], scheduleKind)) {
            setError("Hay horarios superpuestos.");
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
        teacherId: canAssignTeacher ? teacherId || null : undefined,
        scheduleKind,
        allowsRecurring,
        cancelWindowHours: parsedWindow,
        capacity: parsedCapacity,
        startsOn: scheduleKind === "WEEKLY" ? startsOn : null,
        endsOn: scheduleKind === "WEEKLY" && hasEndDate ? endsOn : null,
      };
      const result = isEdit ? await updateActivity(activity!.id, input) : await createActivity(input, slots);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved(result.activity, isEdit ? undefined : slots);
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

          <div>
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

          {!isEdit && (
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Modo de agenda
              </label>
              <select
                value={scheduleKind}
                onChange={(e) => {
                  const kind = e.target.value as ActivityScheduleKind;
                  setScheduleKind(kind);
                  syncStartsOnDefault(kind, uniqueSortedDays(slotDrafts.map((s) => s.dayOfWeek)));
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
            </div>
          )}

          {scheduleKind === "WEEKLY" && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <DatePicker
                    label="Se repite a partir de"
                    value={startsOn}
                    onChange={(v) => {
                      setStartsOn(v);
                      setStartsOnTouched(true);
                    }}
                    disabled={isPending || selectedDays.length === 0}
                  />
                  {selectedDays.length === 0 ? (
                    <p className="text-xs text-gray-500 font-body mt-1">
                      Agregá al menos un horario para poder elegir la fecha de inicio.
                    </p>
                  ) : (
                    <p
                      className={`text-xs font-body mt-1 ${
                        startsOnMismatch ? "text-brand-red font-bold uppercase tracking-wide" : "text-gray-500"
                      }`}
                    >
                      {startsOnMismatch
                        ? `No coincide con ningún horario cargado. Válido: ${formatDayNames(selectedDays)}.`
                        : `Válido: ${formatDayNames(selectedDays)}.`}
                    </p>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hasEndDate}
                      onChange={(e) => setHasEndDate(!e.target.checked)}
                      disabled={isPending}
                    />
                    Sin fecha de fin
                  </label>
                  {hasEndDate && (
                    <DatePicker label="Hasta" value={endsOn} onChange={setEndsOn} disabled={isPending} />
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-body text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowsRecurring}
                  onChange={(e) => setAllowsRecurring(e.target.checked)}
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

            {slotDrafts.map((draft, i) => (
              <div key={i} className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[110px]">
                  {scheduleKind === "WEEKLY" ? (
                    <>
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
                    </>
                  ) : (
                    <DatePicker
                      label="Fecha"
                      value={draft.date}
                      onChange={(v) => updateSlotDraft(i, { date: v })}
                      disabled={isPending}
                    />
                  )}
                </div>
                <div className="min-w-[110px]">
                  <TimePicker
                    label="Inicio"
                    value={draft.startTime}
                    onChange={(v) => updateSlotDraft(i, { startTime: v })}
                    disabled={isPending}
                  />
                </div>
                <div className="min-w-[110px]">
                  <TimePicker
                    label="Fin"
                    value={draft.endTime}
                    onChange={(v) => updateSlotDraft(i, { endTime: v })}
                    disabled={isPending}
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
              onClick={addSlotDraft}
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
