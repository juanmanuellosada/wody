import type { RmData } from "@/components/RmsView";
import type { FixedRoutineStudentViewRoutine } from "@/components/fixed-routine/fixed-routine-view-contracts";
import type { WodForManager } from "@/components/wod/WodManagerView";
import type { GymFixedDemoStudentRoutineDto } from "@/components/demo/training/gym-fixed-demo-types";
import type { GymTrainingStaffWod, GymTrainingStudentWod } from "@/components/demo/training/gym-training-demo-types";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidGymFixedDemoState, projectGymFixedStudentRoutine } from "../training/gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { snapshotDemoStorageValue } from "../training/demo-storage-snapshot.ts";

type ProjectionErrorCode = "INVALID_UTC_DATE" | "INVALID_FIXED_ROUTINE" | "INVALID_FIXED_STATE" | "INVALID_RM" | "UNAUTHORIZED_FIXED_STUDENT";
export type GymDemoProjectionError = Readonly<{ success: false; code: ProjectionErrorCode; error: string }>;
export type GymDemoProjection<T> = Readonly<{ success: true; value: T }> | GymDemoProjectionError;
export type GymViewWod = WodForManager & { teacherId: string; isOwn?: boolean };

/** UTC day keys are the only dates these local ledgers persist. */
export function utcDateFromKey(value: string): GymDemoProjection<Date> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { success: false, code: "INVALID_UTC_DATE", error: "La fecha de demostración no es válida." };
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? { success: true, value: date }
    : { success: false, code: "INVALID_UTC_DATE", error: "La fecha de demostración no es válida." };
}

function mapWod(wod: GymTrainingStaffWod | GymTrainingStudentWod): GymDemoProjection<GymViewWod> {
  const date = utcDateFromKey(wod.date);
  if (!date.success) return date;
  if (wod.targetType === "GROUP") {
    return { success: true, value: { ...wod, date: date.value, targetGroupId: "targetGroupId" in wod ? wod.targetGroupId : null } };
  }
  if (wod.targetType === "STUDENT") {
    return { success: true, value: { ...wod, date: date.value, targetStudentId: "targetStudentId" in wod ? wod.targetStudentId : null } };
  }
  if (wod.targetType === "ALL" || wod.targetType === "PERSONALIZED") return { success: true, value: { ...wod, date: date.value } };
  return { success: false, code: "INVALID_FIXED_ROUTINE", error: "El destinatario de rutina no es válido." };
}

export function mapGymWods(wods: readonly (GymTrainingStaffWod | GymTrainingStudentWod)[]): GymDemoProjection<GymViewWod[]> {
  const output: GymViewWod[] = [];
  for (const wod of wods) {
    const mapped = mapWod(wod);
    if (!mapped.success) return mapped;
    output.push(mapped.value);
  }
  return { success: true, value: output };
}

/** Fixed routine projections preserve the nullable teacher copy used by the shared production view. */
export function mapGymFixedStudentRoutine(value: GymFixedDemoStudentRoutineDto | null): GymDemoProjection<FixedRoutineStudentViewRoutine | null> {
  if (value === null) return { success: true, value: null };
  if (!(value.assignedAt instanceof Date) || !Number.isFinite(value.assignedAt.getTime()) || !(value.renewAt instanceof Date) || !Number.isFinite(value.renewAt.getTime())) {
    return { success: false, code: "INVALID_FIXED_ROUTINE", error: "La rutina fija de demostración no es válida." };
  }
  return { success: true, value: { id: value.id, title: value.title, content: value.content, renewAt: new Date(value.renewAt.getTime()), teacher: value.teacherName === null ? null : { name: value.teacherName } } };
}

/** Distinguishes a valid empty MUSLIB ledger from malformed state before the nullable core projection. */
export function projectGymFixedStudentRoutineSafe(state: unknown, actorToken: unknown): GymDemoProjection<FixedRoutineStudentViewRoutine | null> {
  const actor = resolveGymDemoActor(actorToken);
  if (!actor || actor.role !== "STUDENT" || actor.studentType !== "MUSCULACION_LIBRE" || actor.accountKind !== "FULL") {
    return { success: false, code: "UNAUTHORIZED_FIXED_STUDENT", error: "La identidad de rutina fija no es válida." };
  }
  const captured = snapshotDemoStorageValue(state);
  if (!captured.ok || !isValidGymFixedDemoState(captured.value)) return { success: false, code: "INVALID_FIXED_STATE", error: "El estado de rutinas de demostración no es válido." };
  return mapGymFixedStudentRoutine(projectGymFixedStudentRoutine(captured.value, actorToken));
}

/** Matches FixedRoutineManagerView's production default: thirty calendar-day milliseconds from the Argentina day. */
export function defaultGymFixedRenewAt(today: string): string {
  const parsed = utcDateFromKey(today);
  if (!parsed.success) return today;
  return new Date(parsed.value.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function mapGymRms(rows: readonly { id: string; exercise: string; weight: number; date: Date; createdAt: Date }[]): GymDemoProjection<RmData[]> {
  const output: RmData[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.weight) || row.weight <= 0 || !(row.date instanceof Date) || !Number.isFinite(row.date.getTime()) || !(row.createdAt instanceof Date) || !Number.isFinite(row.createdAt.getTime())) {
      return { success: false, code: "INVALID_RM", error: "Los PRs de demostración no son válidos." };
    }
    output.push({ ...row, date: new Date(row.date.getTime()), createdAt: new Date(row.createdAt.getTime()) });
  }
  return { success: true, value: output };
}
