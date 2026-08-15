"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, type ActivityScheduleKind } from "@prisma/client";
import { gymPath } from "@/lib/gym";
import { SESSION_HORIZON_WEEKS, ensureSessionsForSlot } from "@/lib/activity-schedule";
import { sendPushToUser } from "@/lib/push";
import { toInputDate } from "@/lib/dates";
import { DAY_NAMES } from "@/components/activity/format";

/**
 * Server actions de Actividad (Activity) y horarios recurrentes (ActivitySlot),
 * más gestión manual de inscriptos (ActivityBooking) y cancelación de una
 * sesión puntual (ActivitySession).
 *
 * Permisos (ver openspec/changes/add-turnos-booking/specs/turnos-activities/spec.md,
 * requirement "Permisos de gestión de Actividades"):
 * - ADMIN gestiona todas las Activity de su gym.
 * - TEACHER gestiona únicamente las Activity donde figura como teacherId a
 *   cargo, y como mínimo puede ver y anotar/desanotar inscriptos.
 * - Todo se valida acá, no solo en la UI.
 *
 * `ensureSessionsForSlot` y `SESSION_HORIZON_WEEKS` los provee
 * src/lib/activity-schedule.ts (otro agente trabaja ese archivo en paralelo,
 * ver design.md D2/D5 y tasks 4.1-4.6). Se usan acá solo para materializar
 * de inmediato un horario recién creado, así el admin no espera al cron del
 * día siguiente para ver sus primeras sesiones.
 */

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function revalidateActivityViews(gymSlug: string, activityId?: string) {
  revalidatePath(gymPath(gymSlug, "/turnos/gestion"));
  if (activityId) revalidatePath(gymPath(gymSlug, `/turnos/gestion/${activityId}`));
}

export type ActivityRow = {
  id: string;
  name: string;
  description: string | null;
  teacherId: string | null;
  teacherName: string | null;
  /** WEEKLY = horarios recurrentes; ONE_OFF = fecha única. Fijo desde el alta. */
  scheduleKind: ActivityScheduleKind;
  allowsRecurring: boolean;
  cancelWindowHours: number;
  /** Cupo por defecto de la actividad; lo usa un ActivitySlot cuando el suyo propio es null. */
  capacity: number | null;
  /** YYYY-MM-DD. Solo aplica a WEEKLY; null en ONE_OFF o en actividades WEEKLY creadas antes de este campo. */
  startsOn: string | null;
  /** YYYY-MM-DD. Solo aplica a WEEKLY; null = sin fecha de fin. */
  endsOn: string | null;
  active: boolean;
};

export type ActivityActionResult =
  | { success: true; activity: ActivityRow }
  | { success: false; error: string };

export type SimpleActionResult =
  | { success: true }
  | { success: false; error: string };

const ACTIVITY_SELECT = {
  id: true,
  name: true,
  description: true,
  teacherId: true,
  scheduleKind: true,
  allowsRecurring: true,
  cancelWindowHours: true,
  capacity: true,
  startsOn: true,
  endsOn: true,
  active: true,
  teacher: { select: { name: true } },
} satisfies Prisma.ActivitySelect;

function toActivityRow(a: {
  id: string;
  name: string;
  description: string | null;
  teacherId: string | null;
  scheduleKind: ActivityScheduleKind;
  allowsRecurring: boolean;
  cancelWindowHours: number;
  capacity: number | null;
  startsOn: Date | null;
  endsOn: Date | null;
  active: boolean;
  teacher: { name: string } | null;
}): ActivityRow {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    teacherId: a.teacherId,
    teacherName: a.teacher?.name ?? null,
    scheduleKind: a.scheduleKind,
    allowsRecurring: a.allowsRecurring,
    cancelWindowHours: a.cancelWindowHours,
    capacity: a.capacity,
    startsOn: a.startsOn ? toInputDate(a.startsOn) : null,
    endsOn: a.endsOn ? toInputDate(a.endsOn) : null,
    active: a.active,
  };
}

async function assertCanManageActivities() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") ||
    !session.user.gymId ||
    !session.user.gymSlug
  ) {
    return { ok: false as const, error: "No autorizado." };
  }
  return {
    ok: true as const,
    session,
    gymId: session.user.gymId,
    gymSlug: session.user.gymSlug,
    role: session.user.role,
    userId: session.user.id,
  };
}

async function assertActivityManager(activityId: string) {
  const check = await assertCanManageActivities();
  if (!check.ok) return check;

  const activity = await prisma.activity.findFirst({
    where: { id: activityId },
    select: {
      id: true,
      gymId: true,
      teacherId: true,
      scheduleKind: true,
      startsOn: true,
      gym: { select: { timezone: true } },
    },
  });
  if (!activity || activity.gymId !== check.gymId) {
    return { ok: false as const, error: "Actividad no encontrada." };
  }
  if (check.role === "TEACHER" && activity.teacherId !== check.userId) {
    return { ok: false as const, error: "No autorizado." };
  }

  return { ...check, activity };
}

async function assertSlotManager(slotId: string) {
  const check = await assertCanManageActivities();
  if (!check.ok) return check;

  const slot = await prisma.activitySlot.findFirst({
    where: { id: slotId },
    select: {
      id: true,
      activityId: true,
      active: true,
      activity: { select: { gymId: true, teacherId: true, scheduleKind: true, startsOn: true } },
    },
  });
  if (!slot || slot.activity.gymId !== check.gymId) {
    return { ok: false as const, error: "Horario no encontrado." };
  }
  if (check.role === "TEACHER" && slot.activity.teacherId !== check.userId) {
    return { ok: false as const, error: "No autorizado." };
  }

  return { ...check, slot };
}

function validateActivityInput(input: {
  name: string;
  cancelWindowHours: number;
  capacity: number | null;
}): string | null {
  if (!input.name.trim()) return "El nombre es obligatorio.";
  if (!Number.isFinite(input.cancelWindowHours) || input.cancelWindowHours < 0) {
    return "La ventana de cancelación debe ser un número mayor o igual a cero.";
  }
  if (input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
    return "El cupo debe ser un número entero positivo, o vacío para sin límite.";
  }
  return null;
}

/**
 * Vigencia (startsOn/endsOn) solo tiene sentido en WEEKLY (spec: "Vigencia de
 * una actividad recurrente"). WEEKLY exige startsOn; ONE_OFF prohíbe ambos.
 */
function validateVigencia(
  scheduleKind: ActivityScheduleKind,
  startsOn: string | null,
  endsOn: string | null
): string | null {
  if (scheduleKind === "ONE_OFF") {
    if (startsOn !== null || endsOn !== null) {
      return "La vigencia no aplica a actividades de fecha única.";
    }
    return null;
  }
  if (startsOn === null || parseYMD(startsOn) === null) {
    return "La fecha de inicio de vigencia no es válida.";
  }
  if (endsOn !== null) {
    const parsedEndsOn = parseYMD(endsOn);
    if (parsedEndsOn === null) return "La fecha de fin de vigencia no es válida.";
    if (parsedEndsOn < parseYMD(startsOn)!) {
      return "La fecha de fin debe ser posterior o igual a la de inicio.";
    }
  }
  return null;
}

/**
 * startsOn no es un límite inferior cualquiera: es la primera clase, así que
 * su día de la semana debe coincidir con el dayOfWeek de al menos un
 * ActivitySlot activo (spec: "Vigencia de una actividad recurrente"). Solo
 * aplica a WEEKLY con startsOn cargado. Si `activeDaysOfWeek` está vacío (no
 * hay ningún slot activo con el que comparar) no hay nada que romper, así
 * que no se rechaza. Devuelve la lista de días válidos (para el mensaje de
 * error) si hay un slot activo y el día no coincide con ninguno; null si es
 * consistente o si la regla no aplica.
 */
function startsOnDayMismatch(
  scheduleKind: ActivityScheduleKind,
  startsOn: Date | null,
  activeDaysOfWeek: number[]
): number[] | null {
  if (scheduleKind !== "WEEKLY" || startsOn === null || activeDaysOfWeek.length === 0) return null;
  const uniqueDays = [...new Set(activeDaysOfWeek)].sort((a, b) => a - b);
  if (uniqueDays.includes(startsOn.getUTCDay())) return null;
  return uniqueDays;
}

function formatDayList(days: number[]): string {
  const names = days.map((d) => DAY_NAMES[d]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}

export type ActivityInput = {
  name: string;
  description?: string | null;
  /** undefined = no tocar (solo relevante en edición para TEACHER); ADMIN siempre debe mandar un valor explícito. */
  teacherId?: string | null;
  /**
   * Fijo desde el alta: updateActivity lo ignora. Cambiarlo después dejaría
   * los ActivitySlot existentes incoherentes con el nuevo modo (ver design.md,
   * "el modo vive en la Actividad para no poder mezclar semanal y suelto").
   */
  scheduleKind: ActivityScheduleKind;
  allowsRecurring: boolean;
  cancelWindowHours: number;
  /** Cupo por defecto de la actividad (null = sin límite); cada ActivitySlot puede pisarlo con el suyo propio. */
  capacity: number | null;
  /**
   * YYYY-MM-DD. Vigencia de la actividad: solo aplica a WEEKLY (validateVigencia
   * la exige ahí y la prohíbe en ONE_OFF). startsOn = primera fecha con
   * ocurrencias; endsOn = última (null = sin fin).
   */
  startsOn: string | null;
  endsOn: string | null;
};

/**
 * Crea la Activity y sus horarios (ActivitySlot) en una sola operación
 * (spec: "Alta de Actividad con horarios en un solo paso"). Requiere al
 * menos un horario; los valida igual que createActivitySlot y además
 * rechaza solapamientos entre horarios del mismo día dentro de la misma
 * alta.
 */
export async function createActivity(
  input: ActivityInput,
  slots: SlotInput[]
): Promise<ActivityActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };

  if (input.scheduleKind !== "WEEKLY" && input.scheduleKind !== "ONE_OFF") {
    return { success: false, error: "Modo de agenda inválido." };
  }

  const validationError = validateActivityInput(input);
  if (validationError) return { success: false, error: validationError };

  const slotsError = validateSlots(slots, input.scheduleKind);
  if (slotsError) return { success: false, error: slotsError };

  const vigenciaError = validateVigencia(input.scheduleKind, input.startsOn, input.endsOn);
  if (vigenciaError) return { success: false, error: vigenciaError };

  if (input.scheduleKind === "WEEKLY") {
    const activeDays = slots.map((s) => s.dayOfWeek).filter((d): d is number => d !== null);
    const mismatchDays = startsOnDayMismatch(input.scheduleKind, parseYMD(input.startsOn!), activeDays);
    if (mismatchDays) {
      return {
        success: false,
        error: `La fecha de inicio debe caer en uno de los días con horario cargado: ${formatDayList(mismatchDays)}.`,
      };
    }
  }

  let teacherId: string | null = null;
  if (check.role === "TEACHER") {
    // Un TEACHER siempre queda a cargo de lo que crea, sin importar lo que
    // mande el cliente (spec: "Un TEACHER no puede asignar a otro profe").
    teacherId = check.userId;
  } else if (input.teacherId) {
    const teacher = await prisma.user.findFirst({
      where: { id: input.teacherId, gymId: check.gymId, role: "TEACHER", deletedAt: null },
      select: { id: true },
    });
    if (!teacher) return { success: false, error: "Profe no encontrado." };
    teacherId = teacher.id;
  }

  const { activity, slotIds } = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: {
        gymId: check.gymId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        teacherId,
        scheduleKind: input.scheduleKind,
        allowsRecurring: input.allowsRecurring,
        cancelWindowHours: Math.round(input.cancelWindowHours),
        capacity: input.capacity,
        startsOn: input.startsOn ? parseYMD(input.startsOn) : null,
        endsOn: input.endsOn ? parseYMD(input.endsOn) : null,
      },
      select: ACTIVITY_SELECT,
    });

    const ids: string[] = [];
    for (const s of slots) {
      const slot = await tx.activitySlot.create({
        data: {
          activityId: created.id,
          dayOfWeek: s.dayOfWeek,
          date: s.date ? parseYMD(s.date) : null,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          capacity: s.capacity,
        },
        select: { id: true },
      });
      ids.push(slot.id);
    }

    return { activity: created, slotIds: ids };
  });

  // Materializar de inmediato, igual que createActivitySlot: sin esto el
  // admin no ve ninguna sesión hasta que corra el cron del día siguiente.
  await Promise.all(
    slotIds.map((id) =>
      ensureSessionsForSlot(id, addWeeks(new Date(), SESSION_HORIZON_WEEKS)).catch(() => 0)
    )
  );

  revalidateActivityViews(check.gymSlug);
  return { success: true, activity: toActivityRow(activity) };
}

export async function updateActivity(activityId: string, input: ActivityInput): Promise<ActivityActionResult> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const validationError = validateActivityInput(input);
  if (validationError) return { success: false, error: validationError };

  const vigenciaError = validateVigencia(check.activity.scheduleKind, input.startsOn, input.endsOn);
  if (vigenciaError) return { success: false, error: vigenciaError };

  if (check.activity.scheduleKind === "WEEKLY" && input.startsOn) {
    const activeSlots = await prisma.activitySlot.findMany({
      where: { activityId, active: true },
      select: { dayOfWeek: true },
    });
    const activeDays = activeSlots.map((s) => s.dayOfWeek).filter((d): d is number => d !== null);
    const mismatchDays = startsOnDayMismatch(check.activity.scheduleKind, parseYMD(input.startsOn), activeDays);
    if (mismatchDays) {
      return {
        success: false,
        error: `La fecha de inicio debe caer en uno de los días con horario cargado: ${formatDayList(mismatchDays)}.`,
      };
    }
  }

  let teacherId = check.activity.teacherId;
  if (check.role === "TEACHER") {
    teacherId = check.userId;
  } else if (input.teacherId !== undefined) {
    if (input.teacherId === null) {
      teacherId = null;
    } else {
      const teacher = await prisma.user.findFirst({
        where: { id: input.teacherId, gymId: check.gymId, role: "TEACHER", deletedAt: null },
        select: { id: true },
      });
      if (!teacher) return { success: false, error: "Profe no encontrado." };
      teacherId = teacher.id;
    }
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      teacherId,
      allowsRecurring: input.allowsRecurring,
      cancelWindowHours: Math.round(input.cancelWindowHours),
      capacity: input.capacity,
      startsOn: input.startsOn ? parseYMD(input.startsOn) : null,
      endsOn: input.endsOn ? parseYMD(input.endsOn) : null,
    },
    select: ACTIVITY_SELECT,
  });

  // Si se achicó la vigencia, las sesiones futuras que quedaron afuera de la
  // nueva ventana se cancelan y se notifica a los alumnos anotados (spec:
  // "Vigencia de una actividad recurrente"), reusando cancelSessionsAndNotify.
  if (check.activity.scheduleKind === "WEEKLY") {
    const outOfRangeConditions: Prisma.ActivitySessionWhereInput[] = [];
    if (activity.startsOn) outOfRangeConditions.push({ date: { lt: activity.startsOn } });
    if (activity.endsOn) outOfRangeConditions.push({ date: { gt: activity.endsOn } });

    if (outOfRangeConditions.length > 0) {
      const outOfRangeSessions = await prisma.activitySession.findMany({
        where: {
          slot: { activityId },
          cancelled: false,
          startsAt: { gt: new Date() },
          OR: outOfRangeConditions,
        },
        select: { id: true },
      });
      if (outOfRangeSessions.length > 0) {
        await cancelSessionsAndNotify(
          outOfRangeSessions.map((s) => s.id),
          activity.name,
          check.activity.gym.timezone
        );
      }
    }
  }

  revalidateActivityViews(check.gymSlug, activityId);
  return { success: true, activity: toActivityRow(activity) };
}

export type SlotRow = {
  id: string;
  /** Obligatorio en WEEKLY, null en ONE_OFF. */
  dayOfWeek: number | null;
  /** YYYY-MM-DD. Obligatorio en ONE_OFF, null en WEEKLY. */
  date: string | null;
  startMinute: number;
  endMinute: number;
  capacity: number | null;
  active: boolean;
};

export type SlotActionResult =
  | { success: true; slot: SlotRow }
  | { success: false; error: string };

export type SlotInput = {
  dayOfWeek: number | null;
  /** YYYY-MM-DD */
  date: string | null;
  startMinute: number;
  endMinute: number;
  capacity: number | null;
};

/** "YYYY-MM-DD" (estricto) → Date en medianoche UTC, o null si el formato o la fecha calendario no es válida. */
function parseYMD(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Coherencia con Activity.scheduleKind (ver design.md): WEEKLY exige
 * dayOfWeek y prohíbe date; ONE_OFF exige date y prohíbe dayOfWeek.
 */
function validateSlotInput(input: SlotInput, scheduleKind: ActivityScheduleKind): string | null {
  if (scheduleKind === "WEEKLY") {
    if (input.dayOfWeek === null || !Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      return "El día de la semana no es válido.";
    }
    if (input.date !== null) return "Un horario semanal no debe tener fecha.";
  } else {
    if (input.dayOfWeek !== null) return "Un horario de fecha única no debe tener día de la semana.";
    if (input.date === null || parseYMD(input.date) === null) return "La fecha no es válida.";
  }
  if (!Number.isInteger(input.startMinute) || input.startMinute < 0 || input.startMinute >= 1440) {
    return "La hora de inicio no es válida.";
  }
  if (!Number.isInteger(input.endMinute) || input.endMinute <= input.startMinute || input.endMinute > 1440) {
    return "La hora de fin debe ser posterior a la de inicio.";
  }
  if (input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity <= 0)) {
    return "El cupo debe ser un número entero positivo, o vacío para sin límite.";
  }
  return null;
}

function slotsOverlap(a: SlotInput, b: SlotInput): boolean {
  const sameBucket = (a.dayOfWeek !== null && a.dayOfWeek === b.dayOfWeek) || (a.date !== null && a.date === b.date);
  if (!sameBucket) return false;
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** Valida la lista de horarios del alta en un paso: al menos uno, cada uno válido, sin solapamientos el mismo día/fecha. */
function validateSlots(slots: SlotInput[], scheduleKind: ActivityScheduleKind): string | null {
  if (slots.length === 0) return "Agregá al menos un horario.";
  for (const s of slots) {
    const err = validateSlotInput(s, scheduleKind);
    if (err) return err;
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) return "Hay horarios superpuestos el mismo día.";
    }
  }
  return null;
}

function toSlotRow(slot: {
  id: string;
  dayOfWeek: number | null;
  date: Date | null;
  startMinute: number;
  endMinute: number;
  capacity: number | null;
  active: boolean;
}): SlotRow {
  return {
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    date: slot.date ? toInputDate(slot.date) : null,
    startMinute: slot.startMinute,
    endMinute: slot.endMinute,
    capacity: slot.capacity,
    active: slot.active,
  };
}

export async function createActivitySlot(activityId: string, input: SlotInput): Promise<SlotActionResult> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const validationError = validateSlotInput(input, check.activity.scheduleKind);
  if (validationError) return { success: false, error: validationError };

  if (check.activity.scheduleKind === "WEEKLY" && check.activity.startsOn) {
    const existingActiveSlots = await prisma.activitySlot.findMany({
      where: { activityId, active: true },
      select: { dayOfWeek: true },
    });
    const activeDays = existingActiveSlots.map((s) => s.dayOfWeek).filter((d): d is number => d !== null);
    if (input.dayOfWeek !== null) activeDays.push(input.dayOfWeek);
    const mismatchDays = startsOnDayMismatch(check.activity.scheduleKind, check.activity.startsOn, activeDays);
    if (mismatchDays) {
      return {
        success: false,
        error: `Con este horario, ningún horario activo caería el día de inicio de la actividad (${DAY_NAMES[check.activity.startsOn.getUTCDay()]}). Elegí ese día para este horario, o ajustá primero la fecha de inicio a uno de los días ya cargados: ${formatDayList(mismatchDays)}.`,
      };
    }
  }

  const slot = await prisma.activitySlot.create({
    data: {
      activityId,
      dayOfWeek: input.dayOfWeek,
      date: input.date ? parseYMD(input.date) : null,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      capacity: input.capacity,
    },
  });

  // Materializar de inmediato: sin esto, un horario recién creado no muestra
  // ninguna sesión hasta que corra el cron del día siguiente (ver design.md
  // D2 y tasks 4.2/4.6 — no bloquea el alta si el helper falla).
  try {
    await ensureSessionsForSlot(slot.id, addWeeks(new Date(), SESSION_HORIZON_WEEKS));
  } catch {
    // El cron diario lo termina materializando igual.
  }

  revalidateActivityViews(check.gymSlug, activityId);
  return { success: true, slot: toSlotRow(slot) };
}

export async function updateActivitySlot(slotId: string, input: SlotInput): Promise<SlotActionResult> {
  const check = await assertSlotManager(slotId);
  if (!check.ok) return { success: false, error: check.error };

  const validationError = validateSlotInput(input, check.slot.activity.scheduleKind);
  if (validationError) return { success: false, error: validationError };

  // Cambiar el día de un slot activo puede dejar la fecha de inicio de la
  // actividad sin ningún horario que caiga ese día (spec: "Vigencia de una
  // actividad recurrente"). Se rechaza en vez de corregir en silencio.
  if (check.slot.activity.scheduleKind === "WEEKLY" && check.slot.activity.startsOn && check.slot.active) {
    const otherActiveSlots = await prisma.activitySlot.findMany({
      where: { activityId: check.slot.activityId, active: true, id: { not: slotId } },
      select: { dayOfWeek: true },
    });
    const activeDays = otherActiveSlots.map((s) => s.dayOfWeek).filter((d): d is number => d !== null);
    if (input.dayOfWeek !== null) activeDays.push(input.dayOfWeek);
    const mismatchDays = startsOnDayMismatch(check.slot.activity.scheduleKind, check.slot.activity.startsOn, activeDays);
    if (mismatchDays) {
      return {
        success: false,
        error: `Este cambio dejaría la fecha de inicio de la actividad (${DAY_NAMES[check.slot.activity.startsOn.getUTCDay()]}) sin ningún horario ese día. Ajustá primero la fecha de inicio a uno de los días ya cargados: ${formatDayList(mismatchDays)}.`,
      };
    }
  }

  const slot = await prisma.activitySlot.update({
    where: { id: slotId },
    data: {
      dayOfWeek: input.dayOfWeek,
      date: input.date ? parseYMD(input.date) : null,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      capacity: input.capacity,
    },
  });

  revalidateActivityViews(check.gymSlug, check.slot.activityId);
  return { success: true, slot: toSlotRow(slot) };
}

export async function deactivateActivitySlot(slotId: string): Promise<SimpleActionResult> {
  const check = await assertSlotManager(slotId);
  if (!check.ok) return { success: false, error: check.error };

  // Desactivar el último slot que cae en el día de inicio dejaría la
  // actividad sin ningún horario ese día (spec: "Vigencia de una actividad
  // recurrente"). Se rechaza en vez de corregir en silencio.
  if (check.slot.activity.scheduleKind === "WEEKLY" && check.slot.activity.startsOn) {
    const remainingActiveSlots = await prisma.activitySlot.findMany({
      where: { activityId: check.slot.activityId, active: true, id: { not: slotId } },
      select: { dayOfWeek: true },
    });
    const activeDays = remainingActiveSlots.map((s) => s.dayOfWeek).filter((d): d is number => d !== null);
    const mismatchDays = startsOnDayMismatch(check.slot.activity.scheduleKind, check.slot.activity.startsOn, activeDays);
    if (mismatchDays) {
      return {
        success: false,
        error: `No se puede desactivar: dejaría la fecha de inicio de la actividad (${DAY_NAMES[check.slot.activity.startsOn.getUTCDay()]}) sin ningún horario ese día. Ajustá primero la fecha de inicio a uno de los días que quedarían activos: ${formatDayList(mismatchDays)}.`,
      };
    }
  }

  await prisma.activitySlot.update({ where: { id: slotId }, data: { active: false } });
  revalidateActivityViews(check.gymSlug, check.slot.activityId);
  return { success: true };
}

function buildSessionCancellationMessage(
  activityName: string,
  startsAt: Date,
  timezone: string
): { title: string; body: string } {
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(startsAt);
  return {
    title: "Turno cancelado",
    body: `${activityName} de las ${time} hs fue cancelado.`,
  };
}

/**
 * Cancela una lista de ActivitySession: cada una queda `cancelled`, sus
 * ActivityBooking confirmadas pasan a `CANCELLED` y se avisa por push a cada
 * alumno afectado. Compartido por cancelActivitySession (una sesión puntual)
 * y por updateActivity cuando achicar la vigencia deja sesiones futuras
 * afuera de la nueva ventana (spec: "Vigencia de una actividad recurrente").
 * Un fallo de envío individual no aborta el resto ni las cancelaciones ya
 * confirmadas en su propia transacción.
 */
async function cancelSessionsAndNotify(
  sessionIds: string[],
  activityName: string,
  timezone: string
): Promise<void> {
  for (const sessionId of sessionIds) {
    const activitySession = await prisma.activitySession.findUnique({
      where: { id: sessionId },
      select: { startsAt: true, cancelled: true },
    });
    if (!activitySession || activitySession.cancelled) continue;

    const confirmedBookings = await prisma.activityBooking.findMany({
      where: { sessionId, status: "CONFIRMED" },
      select: { userId: true },
    });

    await prisma.$transaction([
      prisma.activitySession.update({ where: { id: sessionId }, data: { cancelled: true } }),
      prisma.activityBooking.updateMany({
        where: { sessionId, status: "CONFIRMED" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      }),
    ]);

    const { title, body } = buildSessionCancellationMessage(activityName, activitySession.startsAt, timezone);
    await Promise.all(
      confirmedBookings.map(async ({ userId }) => {
        try {
          await sendPushToUser(userId, title, body);
        } catch (err) {
          console.warn("[activity] Failed to send session cancellation push", {
            sessionId,
            userId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );
  }
}

/**
 * Cancela una ActivitySession puntual sin tocar el ActivitySlot que la
 * originó (no afecta las demás fechas del horario recurrente). Deja sin
 * efecto las ActivityBooking confirmadas de esa sesión y avisa por push a
 * los alumnos que tenían reserva confirmada (spec: "Cancelación de sesión
 * notifica a los inscriptos").
 */
export async function cancelActivitySession(sessionId: string): Promise<SimpleActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };

  const activitySession = await prisma.activitySession.findFirst({
    where: { id: sessionId },
    select: {
      id: true,
      gymId: true,
      cancelled: true,
      gym: { select: { timezone: true } },
      slot: { select: { activityId: true, activity: { select: { name: true, teacherId: true } } } },
    },
  });
  if (!activitySession || activitySession.gymId !== check.gymId) {
    return { success: false, error: "Sesión no encontrada." };
  }
  if (check.role === "TEACHER" && activitySession.slot.activity.teacherId !== check.userId) {
    return { success: false, error: "No autorizado." };
  }
  if (activitySession.cancelled) {
    return { success: false, error: "La sesión ya está cancelada." };
  }

  await cancelSessionsAndNotify([sessionId], activitySession.slot.activity.name, activitySession.gym.timezone);

  const activityId = activitySession.slot.activityId;
  revalidateActivityViews(check.gymSlug, activityId);
  revalidatePath(gymPath(check.gymSlug, `/turnos/gestion/${activityId}/sesiones/${sessionId}`));
  return { success: true };
}

/** Alguna vez tuvo una ActivityBooking (confirmada o cancelada) en cualquiera de sus sesiones. */
async function activityHasAnyBookingEver(activityId: string): Promise<boolean> {
  const booking = await prisma.activityBooking.findFirst({
    where: { session: { slot: { activityId } } },
    select: { id: true },
  });
  return !!booking;
}

function futureConfirmedBookingsWhere(activityId: string) {
  return {
    status: "CONFIRMED" as const,
    session: { slot: { activityId }, cancelled: false, startsAt: { gte: new Date() } },
  };
}

export type DeleteActivityPreview =
  | { success: true; willArchive: boolean; futureBookedStudents: number }
  | { success: false; error: string };

/**
 * Calcula qué va a pasar si se elimina la actividad, para mostrarlo en la
 * confirmación antes de ejecutar (spec: "Eliminación de Actividad").
 */
export async function previewActivityDeletion(activityId: string): Promise<DeleteActivityPreview> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const willArchive = await activityHasAnyBookingEver(activityId);
  const futureBookedStudents = willArchive
    ? await prisma.activityBooking.count({ where: futureConfirmedBookingsWhere(activityId) })
    : 0;

  return { success: true, willArchive, futureBookedStudents };
}

export type DeleteActivityResult =
  | { success: true; mode: "deleted" | "archived"; futureBookedStudents: number }
  | { success: false; error: string };

/**
 * Único botón "Eliminar" (spec: "Eliminación de Actividad"). Si la actividad
 * nunca tuvo una ActivityBooking, borrado real (la cascada del schema se
 * lleva slots y sesiones). Si tuvo alguna vez, se archiva (`active = false`)
 * preservando el historial, y se notifica por push a los alumnos con reserva
 * confirmada en sesiones futuras, igual que cancelActivitySession.
 */
export async function deleteActivity(activityId: string): Promise<DeleteActivityResult> {
  const check = await assertActivityManager(activityId);
  if (!check.ok) return { success: false, error: check.error };

  const hadAnyBooking = await activityHasAnyBookingEver(activityId);

  if (!hadAnyBooking) {
    await prisma.activity.delete({ where: { id: activityId } });
    revalidateActivityViews(check.gymSlug, activityId);
    return { success: true, mode: "deleted", futureBookedStudents: 0 };
  }

  const details = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
    select: { name: true, gym: { select: { timezone: true } } },
  });

  const futureBookings = await prisma.activityBooking.findMany({
    where: futureConfirmedBookingsWhere(activityId),
    select: { userId: true, session: { select: { startsAt: true } } },
  });

  await prisma.$transaction([
    prisma.activity.update({ where: { id: activityId }, data: { active: false } }),
    prisma.activityBooking.updateMany({
      where: futureConfirmedBookingsWhere(activityId),
      data: { status: "CANCELLED", cancelledAt: new Date() },
    }),
  ]);

  await Promise.all(
    futureBookings.map(async ({ userId, session }) => {
      const { title, body } = buildSessionCancellationMessage(details.name, session.startsAt, details.gym.timezone);
      try {
        await sendPushToUser(userId, title, body);
      } catch (err) {
        console.warn("[activity] Failed to send activity archival push", {
          activityId,
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  revalidateActivityViews(check.gymSlug, activityId);
  return { success: true, mode: "archived", futureBookedStudents: futureBookings.length };
}

export type BookActionResult =
  | { success: true; bookingId: string }
  | { success: false; error: string };

/**
 * Alta manual de un alumno en una sesión (D6: necesario para cuentas LITE,
 * que no tienen login). Cupo validado de forma atómica (D3): `capacity`
 * nullable = sin límite; nunca comparar columnas entre sí en Prisma, por
 * eso el `updateMany` condicional con el valor leído previamente.
 */
export async function manuallyBookStudent(sessionId: string, studentUserId: string): Promise<BookActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };
  const { gymId } = check;

  const activitySession = await prisma.activitySession.findFirst({
    where: { id: sessionId },
    select: {
      id: true,
      gymId: true,
      cancelled: true,
      capacity: true,
      slot: { select: { activityId: true, activity: { select: { teacherId: true } } } },
    },
  });
  if (!activitySession || activitySession.gymId !== gymId) {
    return { success: false, error: "Sesión no encontrada." };
  }
  if (check.role === "TEACHER" && activitySession.slot.activity.teacherId !== check.userId) {
    return { success: false, error: "No autorizado." };
  }
  if (activitySession.cancelled) {
    return { success: false, error: "No se puede anotar en una sesión cancelada." };
  }

  const student = await prisma.user.findFirst({
    where: { id: studentUserId, gymId, role: "STUDENT", deletedAt: null },
    select: { id: true },
  });
  if (!student) return { success: false, error: "Alumno no encontrado." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.activityBooking.findUnique({
        where: { sessionId_userId: { sessionId, userId: studentUserId } },
      });
      if (existing?.status === "CONFIRMED") {
        return { ok: false as const, error: "El alumno ya está anotado en esta sesión." };
      }

      if (activitySession.capacity === null) {
        await tx.activitySession.update({ where: { id: sessionId }, data: { bookedCount: { increment: 1 } } });
      } else {
        const updated = await tx.activitySession.updateMany({
          where: { id: sessionId, bookedCount: { lt: activitySession.capacity } },
          data: { bookedCount: { increment: 1 } },
        });
        if (updated.count === 0) {
          return { ok: false as const, error: "No hay cupo disponible en esta sesión." };
        }
      }

      let bookingId: string;
      if (existing) {
        const updated = await tx.activityBooking.update({
          where: { id: existing.id },
          data: { status: "CONFIRMED", source: "SINGLE", createdById: check.userId, cancelledAt: null },
          select: { id: true },
        });
        bookingId = updated.id;
      } else {
        const created = await tx.activityBooking.create({
          data: {
            gymId,
            sessionId,
            userId: studentUserId,
            source: "SINGLE",
            status: "CONFIRMED",
            createdById: check.userId,
          },
          select: { id: true },
        });
        bookingId = created.id;
      }

      return { ok: true as const, bookingId };
    });

    if (!result.ok) return { success: false, error: result.error };

    revalidatePath(
      gymPath(check.gymSlug, `/turnos/gestion/${activitySession.slot.activityId}/sesiones/${sessionId}`)
    );
    return { success: true, bookingId: result.bookingId };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "El alumno ya está anotado en esta sesión." };
    }
    throw error;
  }
}

/** Desanota manualmente a un alumno de una sesión. */
export async function manuallyUnbookStudent(bookingId: string): Promise<SimpleActionResult> {
  const check = await assertCanManageActivities();
  if (!check.ok) return { success: false, error: check.error };

  const booking = await prisma.activityBooking.findFirst({
    where: { id: bookingId },
    select: {
      id: true,
      gymId: true,
      sessionId: true,
      status: true,
      session: { select: { slot: { select: { activityId: true, activity: { select: { teacherId: true } } } } } },
    },
  });
  if (!booking || booking.gymId !== check.gymId) {
    return { success: false, error: "Reserva no encontrada." };
  }
  if (check.role === "TEACHER" && booking.session.slot.activity.teacherId !== check.userId) {
    return { success: false, error: "No autorizado." };
  }
  if (booking.status !== "CONFIRMED") {
    return { success: false, error: "La reserva ya estaba cancelada." };
  }

  await prisma.$transaction([
    prisma.activityBooking.update({ where: { id: bookingId }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
    prisma.activitySession.update({ where: { id: booking.sessionId }, data: { bookedCount: { decrement: 1 } } }),
  ]);

  revalidatePath(
    gymPath(check.gymSlug, `/turnos/gestion/${booking.session.slot.activityId}/sesiones/${booking.sessionId}`)
  );
  return { success: true };
}
