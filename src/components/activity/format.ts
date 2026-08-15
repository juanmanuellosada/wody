// Helpers de formato para la gestión de Actividades. `dayOfWeek` sigue la
// convención de Date.getDay() (0 = Domingo ... 6 = Sábado). No confundir con
// src/lib/activity-schedule.ts, que resuelve la conversión hora local ↔
// instante absoluto — esto es solo texto para mostrar en la UI.

import type { ActivityScheduleKind } from "@prisma/client";
import { formatDateArg } from "@/lib/dates";

export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Texto de "cuándo" de un ActivitySlot: día de la semana si es WEEKLY, fecha
 * concreta (dd/mm/yyyy) si es ONE_OFF. Nunca mezcla ambos (ver design.md).
 */
export function formatSlotSchedule(slot: { dayOfWeek: number | null; date: string | null }): string {
  if (slot.date !== null) return formatDateArg(new Date(`${slot.date}T00:00:00.000Z`));
  if (slot.dayOfWeek !== null) return DAY_NAMES[slot.dayOfWeek];
  return "";
}

/** minutos desde medianoche → "HH:MM" (mismo formato que <input type="time">). */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" → minutos desde medianoche, o null si el formato no es válido. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Texto de vigencia de una Activity WEEKLY, a partir de startsOn/endsOn
 * (YYYY-MM-DD, ambos nullable). "" si no hay startsOn cargado (actividad
 * WEEKLY creada antes de este campo).
 */
export function formatVigencia(startsOn: string | null, endsOn: string | null): string {
  if (!startsOn) return "";
  const from = formatDateArg(new Date(`${startsOn}T00:00:00.000Z`));
  if (!endsOn) return `desde el ${from}`;
  const to = formatDateArg(new Date(`${endsOn}T00:00:00.000Z`));
  return `del ${from} al ${to}`;
}

/**
 * Agrupa horarios WEEKLY por (startMinute, endMinute) y arma un texto tipo
 * "Lunes y miércoles de 14:00 a 15:00". Ignora slots ONE_OFF (dayOfWeek null).
 */
export function formatWeeklyDaysAndTime(
  slots: { dayOfWeek: number | null; startMinute: number; endMinute: number }[]
): string {
  const groups = new Map<string, number[]>();
  for (const s of slots) {
    if (s.dayOfWeek === null) continue;
    const key = `${s.startMinute}-${s.endMinute}`;
    const days = groups.get(key) ?? [];
    days.push(s.dayOfWeek);
    groups.set(key, days);
  }
  const parts: string[] = [];
  for (const [key, days] of groups) {
    const [start, end] = key.split("-").map(Number);
    const dayNames = [...days].sort((a, b) => a - b).map((d) => DAY_NAMES[d]);
    const dayText =
      dayNames.length === 1
        ? dayNames[0]
        : `${dayNames.slice(0, -1).join(", ")} y ${dayNames[dayNames.length - 1]}`;
    parts.push(`${dayText} de ${formatMinutes(start)} a ${formatMinutes(end)}`);
  }
  return parts.join("; ");
}

/**
 * Resumen legible del horario de una Activity para listados (ActivityList,
 * detalle): días y horas (WEEKLY) o fechas puntuales (ONE_OFF), más la
 * vigencia cuando aplica. Ver spec "Vigencia de una actividad recurrente".
 */
export function formatActivitySchedule(
  scheduleKind: ActivityScheduleKind,
  slots: { dayOfWeek: number | null; date: string | null; startMinute: number; endMinute: number }[],
  startsOn: string | null,
  endsOn: string | null
): string {
  if (scheduleKind === "ONE_OFF") {
    return slots
      .map((s) => `${formatSlotSchedule(s)} ${formatMinutes(s.startMinute)}–${formatMinutes(s.endMinute)}`)
      .join(", ");
  }
  const daysAndTime = formatWeeklyDaysAndTime(slots);
  const vigencia = formatVigencia(startsOn, endsOn);
  if (!daysAndTime) return vigencia;
  return vigencia ? `${daysAndTime}, ${vigencia}` : daysAndTime;
}
