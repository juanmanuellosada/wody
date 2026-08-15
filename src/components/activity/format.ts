// Helpers de formato para la gestión de Actividades. `dayOfWeek` sigue la
// convención de Date.getDay() (0 = Domingo ... 6 = Sábado). No confundir con
// src/lib/activity-schedule.ts, que resuelve la conversión hora local ↔
// instante absoluto — esto es solo texto para mostrar en la UI.

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
