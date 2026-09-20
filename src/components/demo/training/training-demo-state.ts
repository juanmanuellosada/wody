// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createTrainingDemoFixture } from "./training-demo-fixtures.ts";
import type {
  TrainingActor,
  TrainingDemoCommand,
  TrainingDemoState,
  TrainingGroup,
  TrainingGroupResult,
  TrainingRm,
  TrainingRmResult,
  TrainingResult,
  TrainingTransition,
  TrainingViewProjections,
  TrainingWod,
  TrainingWodResult,
  TrainingWodTarget,
} from "./training-demo-types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function transition<R>(state: TrainingDemoState, result: R): TrainingTransition<R> {
  return { state, result };
}

function failure<R extends { success: false; error: string }>(
  state: TrainingDemoState,
  error: string,
): TrainingTransition<R> {
  return transition(state, { success: false, error } as R);
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isInstant(value: string): boolean {
  return INSTANT_PATTERN.test(value) && !Number.isNaN(new Date(value).getTime()) && new Date(value).toISOString() === value;
}

function currentActor(state: TrainingDemoState): TrainingActor | undefined {
  return state.actors.find((actor) => actor.id === state.selectedActorId);
}

function studentById(state: TrainingDemoState, studentId: string): TrainingActor | undefined {
  const actor = state.actors.find((candidate) => candidate.id === studentId);
  return actor?.role === "STUDENT" ? actor : undefined;
}

function activeGroup(state: TrainingDemoState, groupId: string): TrainingGroup | undefined {
  return state.groups.find((group) => group.id === groupId && group.deletedAt === null);
}

function ownsStudent(state: TrainingDemoState, teacherId: string, studentId: string): boolean {
  return state.teacherStudentLinks.some((link) => link.teacherId === teacherId && link.studentId === studentId);
}

type BoxWodTarget = Exclude<TrainingWodTarget, { type: "MUSCULACION_LIBRE" } | { type: "MUSCULACION_LIBRE_GROUP" }>;
type TargetResolution = { success: true; target: BoxWodTarget } | { success: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validates runtime callback input before any target discriminant is consumed. */
function resolveWodTarget(value: unknown): TargetResolution {
  if (!isRecord(value) || typeof value.type !== "string") return { success: false, error: "Destinatario no válido." };
  if (value.type === "ALL" || value.type === "PERSONALIZED") {
    return "groupId" in value || "studentId" in value
      ? { success: false, error: "Destinatario no válido." }
      : { success: true, target: { type: value.type } };
  }
  if (value.type === "GROUP") {
    return isId(value.groupId) && !("studentId" in value)
      ? { success: true, target: { type: "GROUP", groupId: value.groupId } }
      : { success: false, error: "Destinatario no válido." };
  }
  if (value.type === "STUDENT") {
    return isId(value.studentId) && !("groupId" in value)
      ? { success: true, target: { type: "STUDENT", studentId: value.studentId } }
      : { success: false, error: "Destinatario no válido." };
  }
  if (value.type === "MUSCULACION_LIBRE") {
    return isId(value.studentId) && !("groupId" in value)
      ? { success: false, error: "Las rutinas de musculación no están disponibles en el demo BOX." }
      : { success: false, error: "Destinatario no válido." };
  }
  if (value.type === "MUSCULACION_LIBRE_GROUP") {
    return isId(value.groupId) && !("studentId" in value)
      ? { success: false, error: "Las rutinas de musculación no están disponibles en el demo BOX." }
      : { success: false, error: "Destinatario no válido." };
  }
  return { success: false, error: "Destinatario no válido." };
}

function canWriteWithTarget(state: TrainingDemoState, actor: TrainingActor, target: BoxWodTarget): string | null {
  if (actor.role === "TEACHER" || actor.role === "ADMIN") return validateWodTarget(state, actor.id, target);
  if (actor.role === "STUDENT" && actor.canCreateOwnRoutines && target.type === "STUDENT" && target.studentId === actor.id) return null;
  return "No autorizado.";
}

function validateWodTarget(state: TrainingDemoState, teacherId: string, target: BoxWodTarget): string | null {
  if (target.type === "GROUP") {
    const group = activeGroup(state, target.groupId);
    return group && group.teacherId === teacherId ? null : "Grupo no encontrado.";
  }
  if (target.type === "STUDENT") {
    const student = studentById(state, target.studentId);
    if (!student) return "Alumno no encontrado.";
    return target.studentId === teacherId || ownsStudent(state, teacherId, target.studentId)
      ? null
      : "Alumno no asignado a vos.";
  }
  return null;
}

function targetFields(target: BoxWodTarget): Pick<TrainingWod, "targetType" | "targetGroupId" | "targetStudentId"> {
  return {
    targetType: target.type,
    targetGroupId: target.type === "GROUP" ? target.groupId : null,
    targetStudentId: target.type === "STUDENT" ? target.studentId : null,
  };
}

function sourceTarget(source: TrainingWod): BoxWodTarget | null {
  if (source.targetType === "GROUP") {
    return source.targetGroupId ? { type: "GROUP", groupId: source.targetGroupId } : null;
  }
  if (source.targetType === "STUDENT") {
    return source.targetStudentId ? { type: "STUDENT", studentId: source.targetStudentId } : null;
  }
  return { type: source.targetType };
}

function canWriteExisting(state: TrainingDemoState, actor: TrainingActor, wod: TrainingWod): boolean {
  if (wod.teacherId !== actor.id) return false;
  if (actor.role === "TEACHER" || actor.role === "ADMIN") return true;
  return actor.role === "STUDENT" && actor.canCreateOwnRoutines && wod.targetType === "STUDENT" && wod.targetStudentId === actor.id;
}

function uniqueId(existing: readonly { id: string }[], requestedId: unknown): string | null {
  if (!isId(requestedId) || existing.some((value) => value.id === requestedId)) return null;
  return requestedId;
}

type RmFieldsResolution =
  | { success: true; exercise: string; weight: number; date: string }
  | { success: false; error: string };

/** Validate raw runtime inputs before trimming or consuming their values. */
function resolveRmFields(exercise: unknown, weight: unknown, date: unknown): RmFieldsResolution {
  if (typeof exercise !== "string") return { success: false, error: "El ejercicio no puede estar vacío." };
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
    return { success: false, error: "El peso debe ser mayor a 0." };
  }
  if (typeof date !== "string" || !date) return { success: false, error: "La fecha es obligatoria." };
  if (!isDateKey(date)) return { success: false, error: "La fecha no es válida." };
  const trimmedExercise = exercise.trim();
  if (!trimmedExercise) return { success: false, error: "El ejercicio no puede estar vacío." };
  return { success: true, exercise: trimmedExercise, weight, date };
}

function activeGroupNameTaken(state: TrainingDemoState, teacherId: string, name: string, exceptId?: string): boolean {
  return state.groups.some(
    (group) => group.deletedAt === null && group.teacherId === teacherId && group.id !== exceptId && group.name === name,
  );
}

function canManageGroup(actor: TrainingActor, group: TrainingGroup): boolean {
  return actor.role === "ADMIN" || (actor.role === "TEACHER" && group.teacherId === actor.id);
}

function toViewDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Pure reducer operations preserve the old state reference for every rejected command. */
export function selectTrainingDemoActor(
  state: TrainingDemoState,
  actorId: string,
): TrainingTransition<TrainingResult> {
  if (!state.actors.some((actor) => actor.id === actorId)) return failure(state, "Actor no encontrado.");
  return transition({ ...state, selectedActorId: actorId }, { success: true });
}

export function createTrainingWod(
  state: TrainingDemoState,
  id: unknown,
  date: unknown,
  title: unknown,
  content: unknown,
  target: unknown,
): TrainingTransition<TrainingWodResult> {
  const actor = currentActor(state);
  if (!actor) return failure(state, "No autorizado.");
  if (!isDateKey(date)) return failure(state, "La fecha no es válida.");
  if (typeof title !== "string") return failure(state, "El título del WOD no es válido.");
  if (typeof content !== "string" || !content.trim()) return failure(state, "El contenido del WOD no puede estar vacío.");
  const resolvedTarget = resolveWodTarget(target);
  if (!resolvedTarget.success) return failure(state, resolvedTarget.error);
  const targetError = canWriteWithTarget(state, actor, resolvedTarget.target);
  if (targetError) return failure(state, targetError);
  const wodId = uniqueId(state.wods, id);
  if (!wodId) return failure(state, "Identificador de WOD inválido.");
  const nextTarget = targetFields(resolvedTarget.target);
  const wod: TrainingWod = {
    id: wodId,
    date,
    title: title.trim() || "WOD",
    content,
    teacherId: actor.id,
    ...nextTarget,
  };
  return transition({ ...state, wods: [...state.wods, wod] }, { success: true, wodId });
}

export function updateTrainingWod(
  state: TrainingDemoState,
  wodId: unknown,
  title: unknown,
  content: unknown,
  date?: unknown,
  target?: unknown,
): TrainingTransition<TrainingWodResult> {
  const actor = currentActor(state);
  const wod = typeof wodId === "string" ? state.wods.find((candidate) => candidate.id === wodId) : undefined;
  if (!actor || !wod || !canWriteExisting(state, actor, wod)) return failure(state, "WOD no encontrado.");
  if (date !== undefined && !isDateKey(date)) return failure(state, "La fecha no es válida.");
  if (typeof title !== "string") return failure(state, "El título del WOD no es válido.");
  if (typeof content !== "string" || !content.trim()) return failure(state, "El contenido del WOD no puede estar vacío.");
  const resolvedTarget = target === undefined ? undefined : resolveWodTarget(target);
  if (resolvedTarget && !resolvedTarget.success) return failure(state, resolvedTarget.error);
  if (resolvedTarget) {
    const targetError = canWriteWithTarget(state, actor, resolvedTarget.target);
    if (targetError) return failure(state, targetError);
  }
  const nextDate: string = date === undefined ? wod.date : date;
  const next = {
    ...wod,
    title: title.trim() || "WOD",
    content,
    date: nextDate,
    ...(resolvedTarget?.success ? targetFields(resolvedTarget.target) : {}),
  };
  return transition(
    { ...state, wods: state.wods.map((candidate) => (candidate.id === wodId ? next : candidate)) },
    { success: true },
  );
}

export function deleteTrainingWod(
  state: TrainingDemoState,
  wodId: string,
): TrainingTransition<TrainingWodResult> {
  const actor = currentActor(state);
  const wod = state.wods.find((candidate) => candidate.id === wodId);
  if (!actor || !wod || !canWriteExisting(state, actor, wod)) return failure(state, "WOD no encontrado.");
  return transition({ ...state, wods: state.wods.filter((candidate) => candidate.id !== wodId) }, { success: true });
}

export function copyTrainingWod(
  state: TrainingDemoState,
  id: unknown,
  sourceWodId: unknown,
  targetDate: unknown,
  target?: unknown,
): TrainingTransition<TrainingWodResult> {
  const actor = currentActor(state);
  const source = typeof sourceWodId === "string" ? state.wods.find((candidate) => candidate.id === sourceWodId) : undefined;
  if (!actor || !source || !canWriteExisting(state, actor, source)) return failure(state, "WOD de origen no encontrado.");
  if (!isDateKey(targetDate)) return failure(state, "La fecha no es válida.");
  const sourceFallback = sourceTarget(source);
  if (target === undefined && !sourceFallback) return failure(state, "Grupo no encontrado.");
  const resolvedTarget = target === undefined ? { success: true as const, target: sourceFallback! } : resolveWodTarget(target);
  if (!resolvedTarget.success) return failure(state, resolvedTarget.error);
  const targetError = canWriteWithTarget(state, actor, resolvedTarget.target);
  if (targetError) return failure(state, targetError);
  const wodId = uniqueId(state.wods, id);
  if (!wodId) return failure(state, "Identificador de WOD inválido.");
  return transition(
    {
      ...state,
      wods: [
        ...state.wods,
        {
          id: wodId,
          date: targetDate,
          title: source.title,
          content: source.content,
          teacherId: actor.id,
          ...targetFields(resolvedTarget.target),
        },
      ],
    },
    { success: true, wodId },
  );
}

export function createTrainingGroup(
  state: TrainingDemoState,
  id: string,
  name: string,
): TrainingTransition<TrainingGroupResult> {
  const actor = currentActor(state);
  if (!actor || (actor.role !== "TEACHER" && actor.role !== "ADMIN")) return failure(state, "No autorizado.");
  const trimmed = name.trim();
  if (!trimmed) return failure(state, "El nombre del grupo no puede estar vacío.");
  if (activeGroupNameTaken(state, actor.id, trimmed)) return failure(state, "Ya tenés un grupo con ese nombre.");
  const groupId = uniqueId(state.groups, id);
  if (!groupId) return failure(state, "Identificador de grupo inválido.");
  return transition(
    { ...state, groups: [...state.groups, { id: groupId, name: trimmed, teacherId: actor.id, deletedAt: null }] },
    { success: true, groupId },
  );
}

export function renameTrainingGroup(
  state: TrainingDemoState,
  groupId: string,
  name: string,
): TrainingTransition<TrainingGroupResult> {
  const actor = currentActor(state);
  const group = activeGroup(state, groupId);
  if (!actor || !group || !canManageGroup(actor, group)) return failure(state, "Grupo no encontrado.");
  const trimmed = name.trim();
  if (!trimmed) return failure(state, "El nombre del grupo no puede estar vacío.");
  if (activeGroupNameTaken(state, group.teacherId, trimmed, group.id)) return failure(state, "Ya existe un grupo con ese nombre.");
  return transition(
    { ...state, groups: state.groups.map((candidate) => (candidate.id === groupId ? { ...candidate, name: trimmed } : candidate)) },
    { success: true },
  );
}

export function deleteTrainingGroup(
  state: TrainingDemoState,
  groupId: string,
  deletedAt: string,
): TrainingTransition<TrainingGroupResult> {
  const actor = currentActor(state);
  const group = activeGroup(state, groupId);
  if (!actor || !group || !canManageGroup(actor, group)) return failure(state, "Grupo no encontrado.");
  if (!isInstant(deletedAt)) return failure(state, "La fecha de eliminación no es válida.");
  return transition(
    {
      ...state,
      groups: state.groups.map((candidate) => (candidate.id === groupId ? { ...candidate, deletedAt } : candidate)),
      memberships: state.memberships.filter((membership) => membership.groupId !== groupId),
      // Production keeps GROUP type while its SetNull relation clears this id.
      wods: state.wods.map((wod) => (wod.targetGroupId === groupId ? { ...wod, targetGroupId: null } : wod)),
    },
    { success: true },
  );
}

export function assignTrainingStudentToGroup(
  state: TrainingDemoState,
  studentId: string,
  groupId: string,
): TrainingTransition<TrainingGroupResult> {
  const actor = currentActor(state);
  const group = activeGroup(state, groupId);
  const student = studentById(state, studentId);
  if (!actor || !group || !canManageGroup(actor, group)) return failure(state, "Grupo no encontrado.");
  if (!student) return failure(state, "Alumno no encontrado.");
  if (student.studentType !== "PERSONALIZED") return failure(state, "Solo alumnos personalizados pueden pertenecer a un grupo.");
  if (actor.role !== "ADMIN" && !ownsStudent(state, actor.id, studentId)) return failure(state, "Este alumno no está asignado a vos.");
  if (state.memberships.some((membership) => membership.groupId === groupId && membership.studentId === studentId)) {
    return failure(state, "El alumno ya pertenece a este grupo.");
  }
  return transition({ ...state, memberships: [...state.memberships, { groupId, studentId }] }, { success: true });
}

export function removeTrainingStudentFromGroup(
  state: TrainingDemoState,
  studentId: string,
  groupId: string,
): TrainingTransition<TrainingGroupResult> {
  const actor = currentActor(state);
  const group = activeGroup(state, groupId);
  if (!actor || !group || !canManageGroup(actor, group)) return failure(state, "Grupo no encontrado.");
  return transition(
    { ...state, memberships: state.memberships.filter((membership) => membership.groupId !== groupId || membership.studentId !== studentId) },
    { success: true },
  );
}

/** RMs use the same current-user ownership rule as the production actions. */
export function createTrainingRm(
  state: TrainingDemoState,
  id: unknown,
  exercise: unknown,
  weight: unknown,
  date: unknown,
  createdAt: unknown,
): TrainingTransition<TrainingRmResult> {
  const actor = currentActor(state);
  if (!actor) return failure(state, "No autorizado.");
  const fields = resolveRmFields(exercise, weight, date);
  if (!fields.success) return failure(state, fields.error);
  if (typeof createdAt !== "string" || !isInstant(createdAt)) return failure(state, "La fecha de creación no es válida.");
  const rmId = uniqueId(state.rms, id);
  if (!rmId) return failure(state, "Identificador de RM inválido.");
  const rm: TrainingRm = {
    id: rmId,
    exercise: fields.exercise,
    weight: fields.weight,
    date: fields.date,
    createdAt,
    ownerId: actor.id,
  };
  return transition({ ...state, rms: [...state.rms, rm] }, { success: true });
}

export function updateTrainingRm(
  state: TrainingDemoState,
  rmId: unknown,
  exercise: unknown,
  weight: unknown,
  date: unknown,
): TrainingTransition<TrainingRmResult> {
  const actor = currentActor(state);
  const rm = typeof rmId === "string" ? state.rms.find((candidate) => candidate.id === rmId) : undefined;
  if (!actor || !rm || rm.ownerId !== actor.id) return failure(state, "RM no encontrado.");
  const fields = resolveRmFields(exercise, weight, date);
  if (!fields.success) return failure(state, fields.error);
  return transition(
    {
      ...state,
      rms: state.rms.map((candidate) => candidate.id === rmId
        ? { ...candidate, exercise: fields.exercise, weight: fields.weight, date: fields.date }
        : candidate),
    },
    { success: true },
  );
}

export function deleteTrainingRm(
  state: TrainingDemoState,
  rmId: unknown,
): TrainingTransition<TrainingRmResult> {
  const actor = currentActor(state);
  const rm = typeof rmId === "string" ? state.rms.find((candidate) => candidate.id === rmId) : undefined;
  if (!actor || !rm || rm.ownerId !== actor.id) return failure(state, "RM no encontrado.");
  return transition({ ...state, rms: state.rms.filter((candidate) => candidate.id !== rmId) }, { success: true });
}

/** A validated fixture is always the reset target and retains its selected admin actor. */
export function resetTrainingDemoState(): TrainingDemoState {
  return createTrainingDemoFixture();
}

export function projectTrainingViews(state: TrainingDemoState): TrainingViewProjections {
  const actor = currentActor(state);
  if (!actor) throw new Error("The validated demo state must have a selected actor.");
  const activeGroups = state.groups.filter((group) => group.deletedAt === null);
  const groupName = (groupId: string | null) => activeGroups.find((group) => group.id === groupId)?.name ?? null;
  const actorName = (actorId: string | null) => state.actors.find((candidate) => candidate.id === actorId)?.name ?? null;
  const staffWods = actor.role === "ADMIN" || actor.role === "TEACHER"
    ? state.wods.filter((wod) => wod.teacherId === actor.id)
    : [];
  const ownStudents = state.actors.filter(
    (candidate) => candidate.role === "STUDENT" && candidate.studentType === "PERSONALIZED" && ownsStudent(state, actor.id, candidate.id),
  );
  const staffGroups = activeGroups.filter((group) => group.teacherId === actor.id);
  const groupRows = staffGroups.map((group) => {
    const memberIds = new Set(state.memberships.filter((membership) => membership.groupId === group.id).map((membership) => membership.studentId));
    return {
      id: group.id,
      name: group.name,
      students: ownStudents.filter((student) => memberIds.has(student.id)).map(({ id, name }) => ({ id, name })),
      availableToAdd: ownStudents.filter((student) => !memberIds.has(student.id)).map(({ id, name }) => ({ id, name })),
    };
  });
  const visibleStudentWods = actor.role !== "STUDENT"
    ? []
    : state.wods.filter((wod) => {
        const personalizedTargetVisible = actor.studentType === "PERSONALIZED" && (
          wod.targetType === "PERSONALIZED" ||
          (wod.targetType === "GROUP" && wod.targetGroupId !== null && state.memberships.some((membership) => membership.groupId === wod.targetGroupId && membership.studentId === actor.id)) ||
          (wod.targetType === "STUDENT" && wod.targetStudentId === actor.id)
        );
        const teacherVisible = ownsStudent(state, wod.teacherId, actor.id) && (wod.targetType === "ALL" || personalizedTargetVisible);
        const ownVisible = actor.canCreateOwnRoutines && wod.teacherId === actor.id && wod.targetType === "STUDENT" && wod.targetStudentId === actor.id;
        return teacherVisible || ownVisible;
      });
  return {
    selectedActor: actor,
    staff: {
      wods: staffWods.map((wod) => ({ ...wod, date: toViewDate(wod.date), targetGroupName: groupName(wod.targetGroupId), targetStudentName: actorName(wod.targetStudentId) })),
      groups: groupRows,
      students: ownStudents.map(({ id, name }) => ({ id, name })),
    },
    student: {
      wods: visibleStudentWods.map((wod) => ({
        id: wod.id,
        title: wod.title,
        content: wod.content,
        date: toViewDate(wod.date),
        teacherId: wod.teacherId,
        targetType: wod.targetType,
        targetGroupName: groupName(wod.targetGroupId),
        isOwn: wod.teacherId === actor.id,
      })),
    },
    // Production orders by RM date descending and scopes the query to the session user.
    rms: state.rms
      .filter((rm) => rm.ownerId === actor.id)
      .sort((left, right) => right.date.localeCompare(left.date))
      .map((rm) => ({
        id: rm.id,
        exercise: rm.exercise,
        weight: rm.weight,
        date: toViewDate(rm.date),
        createdAt: new Date(rm.createdAt),
      })),
  };
}

export function reduceTrainingDemo(
  state: TrainingDemoState,
  command: TrainingDemoCommand,
): TrainingTransition<TrainingResult | TrainingWodResult | TrainingGroupResult | TrainingRmResult> {
  switch (command.type) {
    case "select-actor": return selectTrainingDemoActor(state, command.actorId);
    case "reset": return transition(resetTrainingDemoState(), { success: true });
    case "create-wod": return createTrainingWod(state, command.id, command.date, command.title, command.content, command.target);
    case "update-wod": return updateTrainingWod(state, command.wodId, command.title, command.content, command.date, command.target);
    case "delete-wod": return deleteTrainingWod(state, command.wodId);
    case "copy-wod": return copyTrainingWod(state, command.id, command.sourceWodId, command.targetDate, command.target);
    case "create-group": return createTrainingGroup(state, command.id, command.name);
    case "rename-group": return renameTrainingGroup(state, command.groupId, command.name);
    case "delete-group": return deleteTrainingGroup(state, command.groupId, command.deletedAt);
    case "assign-student": return assignTrainingStudentToGroup(state, command.studentId, command.groupId);
    case "remove-student": return removeTrainingStudentFromGroup(state, command.studentId, command.groupId);
    case "create-rm": return createTrainingRm(state, command.id, command.exercise, command.weight, command.date, command.createdAt);
    case "update-rm": return updateTrainingRm(state, command.rmId, command.exercise, command.weight, command.date);
    case "delete-rm": return deleteTrainingRm(state, command.rmId);
  }
}
