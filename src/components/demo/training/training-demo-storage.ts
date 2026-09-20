// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createTrainingDemoFixture } from "./training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { TRAINING_DEMO_NAMESPACE, TRAINING_DEMO_STORAGE_KEY, TRAINING_DEMO_VERSION } from "./training-demo-types.ts";
import type { TrainingDemoState } from "./training-demo-types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type TrainingDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type TrainingStorageLoad = { state: TrainingDemoState; warning: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isInstant(value: unknown): value is string {
  return typeof value === "string" && INSTANT_PATTERN.test(value) && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString() === value;
}

function uniquePair(values: readonly Record<string, unknown>[], left: string, right: string): boolean {
  const pairs = values.map((value) => `${value[left]}:${value[right]}`);
  return new Set(pairs).size === pairs.length;
}

/** Validates the whole normalized graph before any local history can be reused. */
export function isValidTrainingDemoState(value: unknown): value is TrainingDemoState {
  if (!isRecord(value) || value.version !== TRAINING_DEMO_VERSION || value.namespace !== TRAINING_DEMO_NAMESPACE || !isId(value.selectedActorId)) return false;
  if (!Array.isArray(value.actors) || !Array.isArray(value.teacherStudentLinks) || !Array.isArray(value.groups) || !Array.isArray(value.memberships) || !Array.isArray(value.wods) || !Array.isArray(value.rms)) return false;

  const actors = value.actors;
  if (!actors.every((actor) =>
    isRecord(actor) &&
    isId(actor.id) &&
    isId(actor.name) &&
    (actor.role === "ADMIN" || actor.role === "TEACHER" || actor.role === "STUDENT") &&
    typeof actor.canCreateOwnRoutines === "boolean" &&
    (actor.role === "STUDENT"
      ? actor.studentType === "GENERAL" || actor.studentType === "PERSONALIZED"
      : actor.studentType === null),
  )) return false;
  if (new Set(actors.map((actor) => actor.id)).size !== actors.length || !actors.some((actor) => actor.id === value.selectedActorId)) return false;
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));

  const links = value.teacherStudentLinks;
  if (!links.every((link) => {
    if (!isRecord(link) || !isId(link.teacherId) || !isId(link.studentId)) return false;
    const teacher = actorById.get(link.teacherId);
    return (teacher?.role === "TEACHER" || teacher?.role === "ADMIN") && actorById.get(link.studentId)?.role === "STUDENT";
  }) || !uniquePair(links as Record<string, unknown>[], "teacherId", "studentId")) return false;
  const ownsStudent = (teacherId: string, studentId: string) => links.some((link) => link.teacherId === teacherId && link.studentId === studentId);

  const groups = value.groups;
  if (!groups.every((group) =>
    isRecord(group) &&
    isId(group.id) &&
    isId(group.name) &&
    isId(group.teacherId) &&
    (group.deletedAt === null || isInstant(group.deletedAt)) &&
    (actorById.get(group.teacherId)?.role === "TEACHER" || actorById.get(group.teacherId)?.role === "ADMIN"),
  )) return false;
  if (new Set(groups.map((group) => group.id)).size !== groups.length) return false;
  const activeGroupNames = groups.filter((group) => group.deletedAt === null).map((group) => `${group.teacherId}:${group.name}`);
  if (new Set(activeGroupNames).size !== activeGroupNames.length) return false;
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const memberships = value.memberships;
  if (!memberships.every((membership) => {
    if (!isRecord(membership) || !isId(membership.groupId) || !isId(membership.studentId)) return false;
    const group = groupById.get(membership.groupId);
    const student = actorById.get(membership.studentId);
    return !!group && group.deletedAt === null && student?.role === "STUDENT" && student.studentType === "PERSONALIZED";
  }) || !uniquePair(memberships as Record<string, unknown>[], "groupId", "studentId")) return false;

  const wods = value.wods;
  if (!wods.every((wod) => {
    if (!isRecord(wod) || !isId(wod.id) || !isId(wod.title) || typeof wod.content !== "string" || !wod.content.trim() || !isDateKey(wod.date) || !isId(wod.teacherId)) return false;
    const teacher = actorById.get(wod.teacherId);
    if (!teacher || (teacher.role !== "ADMIN" && teacher.role !== "TEACHER" && !(teacher.role === "STUDENT" && teacher.canCreateOwnRoutines))) return false;
    if (wod.targetType !== "ALL" && wod.targetType !== "PERSONALIZED" && wod.targetType !== "GROUP" && wod.targetType !== "STUDENT") return false;
    // actions/wod.ts permits self-service students only to author a self STUDENT target.
    if (teacher.role === "STUDENT" && (!teacher.canCreateOwnRoutines || wod.targetType !== "STUDENT" || wod.targetStudentId !== wod.teacherId)) return false;
    if (wod.targetType === "ALL" || wod.targetType === "PERSONALIZED") return wod.targetGroupId === null && wod.targetStudentId === null;
    if (wod.targetType === "GROUP") {
      if (wod.targetStudentId !== null) return false;
      // Soft-deleted production groups retain GROUP while SetNull clears only this relation.
      if (wod.targetGroupId === null) return true;
      const group = groupById.get(wod.targetGroupId);
      return !!group && group.deletedAt === null && group.teacherId === wod.teacherId;
    }
    if (wod.targetGroupId !== null || !isId(wod.targetStudentId)) return false;
    const student = actorById.get(wod.targetStudentId);
    return !!student && student.role === "STUDENT" && (
      wod.targetStudentId === wod.teacherId || ownsStudent(wod.teacherId, wod.targetStudentId)
    );
  })) return false;
  if (new Set(wods.map((wod) => wod.id)).size !== wods.length) return false;

  const rms = value.rms;
  if (!rms.every((rm) =>
    isRecord(rm) &&
    isId(rm.id) &&
    isId(rm.exercise) &&
    typeof rm.weight === "number" && Number.isFinite(rm.weight) && rm.weight > 0 &&
    isDateKey(rm.date) &&
    isInstant(rm.createdAt) &&
    isId(rm.ownerId) && actorById.has(rm.ownerId),
  )) return false;
  if (new Set(rms.map((rm) => rm.id)).size !== rms.length) return false;

  return true;
}

export function serializeTrainingDemoState(state: TrainingDemoState): string {
  if (!isValidTrainingDemoState(state)) throw new Error("Cannot serialize an invalid training demo state.");
  return JSON.stringify(state);
}

/**
 * Resolves only serializable local inputs: valid storage takes precedence, while
 * a valid injected state is the fallback for absent or malformed storage.
 */
export function resolveTrainingDemoInitialState(
  raw: string | null | undefined,
  fallback?: unknown,
): TrainingStorageLoad {
  const safeFallback = isValidTrainingDemoState(fallback) ? fallback : createTrainingDemoFixture();
  if (!raw) return { state: safeFallback, warning: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidTrainingDemoState(parsed)
      ? { state: parsed, warning: null }
      : { state: safeFallback, warning: "El estado guardado no es válido; se usó el estado de respaldo." };
  } catch {
    return { state: safeFallback, warning: "El estado guardado no es válido; se usó el estado de respaldo." };
  }
}

export function restoreTrainingDemoState(raw: string | null | undefined): TrainingDemoState {
  return resolveTrainingDemoInitialState(raw).state;
}

/** Storage is optional; read failures are non-fatal and continue with the validated fallback. */
export function loadTrainingDemoState(
  storage: TrainingDemoStorage | null | undefined,
  fallback?: unknown,
): TrainingStorageLoad {
  const safeFallback = isValidTrainingDemoState(fallback) ? fallback : createTrainingDemoFixture();
  if (!storage) return { state: safeFallback, warning: "El almacenamiento local no está disponible; los cambios no se conservarán." };
  try {
    return resolveTrainingDemoInitialState(storage.getItem(TRAINING_DEMO_STORAGE_KEY), safeFallback);
  } catch {
    return { state: safeFallback, warning: "No se pudo leer el almacenamiento local; se usó el estado de respaldo." };
  }
}

export function persistTrainingDemoState(storage: TrainingDemoStorage | null | undefined, state: TrainingDemoState): string | null {
  if (!storage) return "El almacenamiento local no está disponible; los cambios no se conservarán.";
  try {
    storage.setItem(TRAINING_DEMO_STORAGE_KEY, serializeTrainingDemoState(state));
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
