// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { datedTrainingDenseArray, datedTrainingRecord, datedTrainingTitle, detachDatedTrainingGroup, frozenDatedTrainingSnapshot, isDatedTrainingId, isDatedTrainingInstant, isStoredDatedTrainingDate, normalizeDatedTrainingActionDate } from "./dated-training-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_TRAINING_DEMO_KIND, GYM_TRAINING_DEMO_NAMESPACE, GYM_TRAINING_DEMO_VERSION } from "./gym-training-demo-types.ts";
import type {
  GymFixedGroupAssignment,
  GymTrainingDemoState,
  GymTrainingGroup,
  GymTrainingGroupMembership,
  GymTrainingGroupResult,
  GymTrainingProjection,
  GymTrainingTransition,
  GymTrainingWod,
  GymTrainingWodResult,
  GymTrainingWodTarget,
} from "./gym-training-demo-types";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_DEMO_GYM_ID, getGymDemoProfiles, getGymDemoTeacherStudentLinks, resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type { GymDemoCanonicalActor, GymDemoProfile } from "../scenarios/gym-demo-directory";

const directoryProfiles = Object.freeze(getGymDemoProfiles().map((profile) => Object.freeze({ ...profile })));
const directoryProfileById = new Map(directoryProfiles.map((profile) => [profile.id, profile]));
const directoryLinks = Object.freeze(getGymDemoTeacherStudentLinks().map((link) => Object.freeze({ ...link })));

type DatedTarget = Exclude<GymTrainingWodTarget, { type: "MUSCULACION_LIBRE" } | { type: "MUSCULACION_LIBRE_GROUP" }>;
type TargetResolution = { success: true; target: DatedTarget } | { success: false; error: string };

function transition<R>(state: GymTrainingDemoState, result: R): GymTrainingTransition<R> {
  return { state, result };
}

function failure<R extends { success: false; error: string }>(state: GymTrainingDemoState, error: string): GymTrainingTransition<R> {
  return transition(state, Object.freeze({ success: false, error }) as R);
}

function projectionFailure(error: string): GymTrainingProjection {
  return Object.freeze({ success: false, error });
}

function isStaff(actor: GymDemoCanonicalActor): boolean {
  return actor.role === "ADMIN" || actor.role === "TEACHER";
}

function directoryProfile(id: string): Readonly<GymDemoProfile> | null {
  const profile = directoryProfileById.get(id);
  return profile && profile.gymId === GYM_DEMO_GYM_ID ? profile : null;
}

function activeStudent(id: string): Readonly<GymDemoProfile> | null {
  const profile = directoryProfile(id);
  return profile && profile.deletedAt === null && profile.role === "STUDENT" ? profile : null;
}

function activeStaff(id: string): Readonly<GymDemoProfile> | null {
  const profile = directoryProfile(id);
  return profile && profile.deletedAt === null && (profile.role === "ADMIN" || profile.role === "TEACHER") ? profile : null;
}

function linked(teacherId: string, studentId: string): boolean {
  return directoryLinks.some((link) => link.teacherId === teacherId && link.studentId === studentId);
}

function activeGroup(state: GymTrainingDemoState, groupId: string): GymTrainingGroup | null {
  return state.groups.find((group) => group.id === groupId && group.deletedAt === null) ?? null;
}

function targetFields(target: DatedTarget): Pick<GymTrainingWod, "targetType" | "targetGroupId" | "targetStudentId"> {
  return {
    targetType: target.type,
    targetGroupId: target.type === "GROUP" ? target.groupId : null,
    targetStudentId: target.type === "STUDENT" ? target.studentId : null,
  };
}

function sourceTarget(source: GymTrainingWod): DatedTarget | null {
  if (source.targetType === "GROUP") return source.targetGroupId ? { type: "GROUP", groupId: source.targetGroupId } : null;
  if (source.targetType === "STUDENT") return source.targetStudentId ? { type: "STUDENT", studentId: source.targetStudentId } : null;
  return { type: source.targetType };
}

/** No UI-only musculación target can cross into the dated WOD ledger. */
function resolveTarget(value: unknown): TargetResolution {
  const record = datedTrainingRecord(value, ["type"], ["groupId", "studentId"]);
  if (!record || typeof record.type !== "string") return { success: false, error: "Destinatario no válido." };
  if (record.type === "ALL" || record.type === "PERSONALIZED") {
    return record.groupId === undefined && record.studentId === undefined
      ? { success: true, target: { type: record.type } }
      : { success: false, error: "Destinatario no válido." };
  }
  if (record.type === "GROUP") {
    return isDatedTrainingId(record.groupId) && record.studentId === undefined
      ? { success: true, target: { type: "GROUP", groupId: record.groupId } }
      : { success: false, error: "Destinatario no válido." };
  }
  if (record.type === "STUDENT") {
    return isDatedTrainingId(record.studentId) && record.groupId === undefined
      ? { success: true, target: { type: "STUDENT", studentId: record.studentId } }
      : { success: false, error: "Destinatario no válido." };
  }
  return { success: false, error: "Destinatario no válido." };
}

/** Mirrors actions/wod.ts: groups remain actor-owned; direct targets require the actor's teacher link, even for ADMIN. */
function targetError(state: GymTrainingDemoState, actor: GymDemoCanonicalActor, target: DatedTarget): string | null {
  if (target.type === "GROUP") {
    const group = activeGroup(state, target.groupId);
    return group && group.teacherId === actor.id ? null : "Grupo no encontrado.";
  }
  if (target.type === "STUDENT") {
    const student = activeStudent(target.studentId);
    // validateTarget performs its TeacherStudent lookup after an absent user lookup;
    // the observable production result for an unknown direct target is this link error.
    if (!student) return "Alumno no asignado a vos.";
    if (student.accountKind === "LITE") return "No se pueden asignar rutinas a un alumno lite.";
    return target.studentId === actor.id || linked(actor.id, student.id) ? null : "Alumno no asignado a vos.";
  }
  return null;
}

const GYM_WOD_NOT_FOUND = "Rutina no encontrada.";
const GYM_WOD_SOURCE_NOT_FOUND = "Rutina origen no encontrada.";
const GYM_WOD_CONTENT_EMPTY = "El contenido de la Rutina no puede estar vacio.";
// The live query is `orderBy: { name: "asc" }`; this explicit Spanish presentation
// collation is deterministic for the demo but does not claim PostgreSQL equivalence for arbitrary Unicode.
const GYM_GROUP_NAME_COLLATOR = new Intl.Collator("es");

function byDatedWodDescending(left: { date: string }, right: { date: string }): number {
  // Array#sort is stable; equal dates retain their query/ledger encounter order, like the unspecified DB tie order.
  return right.date.localeCompare(left.date);
}

function canEditExisting(actor: GymDemoCanonicalActor, wod: GymTrainingWod): boolean {
  // Production fetches an owned WOD before role policy; all canonical GYM authors here are staff.
  return isStaff(actor) && wod.teacherId === actor.id;
}

function uniqueId(values: readonly { id: string }[], requested: unknown): string | null {
  return isDatedTrainingId(requested) && !values.some((value) => value.id === requested) ? requested : null;
}

function groupNameTaken(state: GymTrainingDemoState, teacherId: string, name: string, exceptId?: string): boolean {
  return state.groups.some((group) => group.deletedAt === null && group.teacherId === teacherId && group.id !== exceptId && group.name === name);
}

function canManageGroup(actor: GymDemoCanonicalActor, group: GymTrainingGroup): boolean {
  return actor.role === "ADMIN" || (actor.role === "TEACHER" && group.teacherId === actor.id);
}

function groupRecord(value: unknown): GymTrainingGroup | null {
  const record = datedTrainingRecord(value, ["id", "name", "teacherId", "deletedAt"]);
  if (!record || !isDatedTrainingId(record.id) || !isDatedTrainingId(record.name) || !isDatedTrainingId(record.teacherId) || (record.deletedAt !== null && !isDatedTrainingInstant(record.deletedAt))) return null;
  return activeStaff(record.teacherId) ? record as GymTrainingGroup : null;
}

function membershipRecord(value: unknown): GymTrainingGroupMembership | null {
  const record = datedTrainingRecord(value, ["groupId", "studentId"]);
  return record && isDatedTrainingId(record.groupId) && isDatedTrainingId(record.studentId) ? record as GymTrainingGroupMembership : null;
}

function wodRecord(value: unknown): GymTrainingWod | null {
  const record = datedTrainingRecord(value, ["id", "title", "content", "date", "teacherId", "targetType", "targetGroupId", "targetStudentId"]);
  if (!record || !isDatedTrainingId(record.id) || !isDatedTrainingId(record.title) || typeof record.content !== "string" || !record.content.trim() || !isStoredDatedTrainingDate(record.date) || !isDatedTrainingId(record.teacherId) || !activeStaff(record.teacherId)) return null;
  if (record.targetType !== "ALL" && record.targetType !== "PERSONALIZED" && record.targetType !== "GROUP" && record.targetType !== "STUDENT") return null;
  if (record.targetType === "ALL" || record.targetType === "PERSONALIZED") return record.targetGroupId === null && record.targetStudentId === null ? record as GymTrainingWod : null;
  if (record.targetType === "GROUP") return record.targetStudentId === null && (record.targetGroupId === null || isDatedTrainingId(record.targetGroupId)) ? record as GymTrainingWod : null;
  return record.targetGroupId === null && isDatedTrainingId(record.targetStudentId) ? record as GymTrainingWod : null;
}

/** Validates only a closed, serializable GYM ledger. Directory identity never becomes persisted state. */
export function isValidGymTrainingDemoState(value: unknown): value is GymTrainingDemoState {
  const record = datedTrainingRecord(value, ["version", "namespace", "kind", "groups", "memberships", "wods"]);
  if (!record || record.version !== GYM_TRAINING_DEMO_VERSION || record.namespace !== GYM_TRAINING_DEMO_NAMESPACE || record.kind !== GYM_TRAINING_DEMO_KIND) return false;
  const groups = datedTrainingDenseArray(record.groups);
  const memberships = datedTrainingDenseArray(record.memberships);
  const wods = datedTrainingDenseArray(record.wods);
  if (!groups || !memberships || !wods) return false;

  const validGroups = groups.map(groupRecord);
  if (validGroups.some((group) => !group) || new Set(validGroups.map((group) => group!.id)).size !== validGroups.length) return false;
  const groupById = new Map(validGroups.map((group) => [group!.id, group!]));
  const names = validGroups.filter((group) => group!.deletedAt === null).map((group) => `${group!.teacherId}:${group!.name}`);
  if (new Set(names).size !== names.length) return false;

  const validMemberships = memberships.map(membershipRecord);
  if (validMemberships.some((membership) => !membership)) return false;
  const membershipPairs = new Set<string>();
  for (const membership of validMemberships) {
    const group = groupById.get(membership!.groupId);
    const student = activeStudent(membership!.studentId);
    if (!group || group.deletedAt !== null || !student || (student.studentType !== "PERSONALIZED" && student.studentType !== "MUSCULACION_LIBRE")) return false;
    const pair = `${membership!.groupId}:${membership!.studentId}`;
    if (membershipPairs.has(pair)) return false;
    membershipPairs.add(pair);
  }

  const validWods = wods.map(wodRecord);
  if (validWods.some((wod) => !wod) || new Set(validWods.map((wod) => wod!.id)).size !== validWods.length) return false;
  for (const wod of validWods) {
    if (wod!.targetType === "GROUP" && wod!.targetGroupId !== null) {
      const group = groupById.get(wod!.targetGroupId);
      if (!group || group.deletedAt !== null || group.teacherId !== wod!.teacherId) return false;
    }
    if (wod!.targetType === "STUDENT") {
      const student = activeStudent(wod!.targetStudentId!);
      if (!student || student.accountKind === "LITE" || !linked(wod!.teacherId, student.id)) return false;
    }
  }
  return true;
}

function authorizedState<R>(
  state: GymTrainingDemoState,
  actorToken: unknown,
): { actor: GymDemoCanonicalActor; invalid: null } | { actor: null; invalid: GymTrainingTransition<R> } {
  // This is deliberately first: no state, command, date, or projection value is inspected before token identity resolution.
  const actor = resolveGymDemoActor(actorToken);
  if (!actor || !isStaff(actor)) return { actor: null, invalid: failure(state, "No autorizado.") as GymTrainingTransition<R> };
  if (!isValidGymTrainingDemoState(state)) return { actor: null, invalid: failure(state, "El estado de entrenamiento no es válido.") as GymTrainingTransition<R> };
  return { actor, invalid: null };
}

export function createGymTrainingWod(state: GymTrainingDemoState, actorToken: unknown, id: unknown, date: unknown, title: unknown, content: unknown, target: unknown): GymTrainingTransition<GymTrainingWodResult> {
  const authorized = authorizedState<GymTrainingWodResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  if (typeof title !== "string") return failure(state, "El título de la rutina no es válido.");
  if (typeof content !== "string" || !content.trim()) return failure(state, GYM_WOD_CONTENT_EMPTY);
  const resolved = resolveTarget(target);
  if (!resolved.success) return failure(state, resolved.error);
  const targetFailure = targetError(state, authorized.actor!, resolved.target);
  if (targetFailure) return failure(state, targetFailure);
  const normalizedDate = normalizeDatedTrainingActionDate(date);
  if (!normalizedDate) return failure(state, "La fecha no es válida.");
  const wodId = uniqueId(state.wods, id);
  if (!wodId) return failure(state, "Identificador de rutina inválido.");
  const wod: GymTrainingWod = { id: wodId, date: normalizedDate, title: datedTrainingTitle(title, "Rutina"), content, teacherId: authorized.actor!.id, ...targetFields(resolved.target) };
  return transition({ ...state, wods: [...state.wods, wod] }, Object.freeze({ success: true, wodId }));
}

export function updateGymTrainingWod(state: GymTrainingDemoState, actorToken: unknown, wodId: unknown, title: unknown, content: unknown, date?: unknown, target?: unknown): GymTrainingTransition<GymTrainingWodResult> {
  const authorized = authorizedState<GymTrainingWodResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  const wod = typeof wodId === "string" ? state.wods.find((candidate) => candidate.id === wodId) : undefined;
  if (!wod || !canEditExisting(authorized.actor!, wod)) return failure(state, GYM_WOD_NOT_FOUND);
  if (typeof title !== "string") return failure(state, "El título de la rutina no es válido.");
  if (typeof content !== "string" || !content.trim()) return failure(state, GYM_WOD_CONTENT_EMPTY);
  const resolved = target === undefined ? undefined : resolveTarget(target);
  if (resolved && !resolved.success) return failure(state, resolved.error);
  if (resolved?.success) {
    const targetFailure = targetError(state, authorized.actor!, resolved.target);
    if (targetFailure) return failure(state, targetFailure);
  }
  const nextDate = date === undefined || date === "" ? wod.date : normalizeDatedTrainingActionDate(date);
  if (!nextDate) return failure(state, "La fecha no es válida.");
  const next = { ...wod, title: datedTrainingTitle(title, "Rutina"), content, date: nextDate, ...(resolved?.success ? targetFields(resolved.target) : {}) };
  return transition({ ...state, wods: state.wods.map((candidate) => candidate.id === wod.id ? next : candidate) }, Object.freeze({ success: true }));
}

export function deleteGymTrainingWod(state: GymTrainingDemoState, actorToken: unknown, wodId: unknown): GymTrainingTransition<GymTrainingWodResult> {
  const authorized = authorizedState<GymTrainingWodResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  const wod = typeof wodId === "string" ? state.wods.find((candidate) => candidate.id === wodId) : undefined;
  if (!wod || !canEditExisting(authorized.actor!, wod)) return failure(state, GYM_WOD_NOT_FOUND);
  return transition({ ...state, wods: state.wods.filter((candidate) => candidate.id !== wod.id) }, Object.freeze({ success: true }));
}

export function copyGymTrainingWod(state: GymTrainingDemoState, actorToken: unknown, id: unknown, sourceWodId: unknown, targetDate: unknown, target?: unknown): GymTrainingTransition<GymTrainingWodResult> {
  const authorized = authorizedState<GymTrainingWodResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  const source = typeof sourceWodId === "string" ? state.wods.find((candidate) => candidate.id === sourceWodId) : undefined;
  if (!source || !canEditExisting(authorized.actor!, source)) return failure(state, GYM_WOD_SOURCE_NOT_FOUND);
  const fallback = sourceTarget(source);
  if (target === undefined && !fallback) return failure(state, "Grupo no encontrado.");
  const resolved = target === undefined ? { success: true as const, target: fallback! } : resolveTarget(target);
  if (!resolved.success) return failure(state, resolved.error);
  const targetFailure = targetError(state, authorized.actor!, resolved.target);
  if (targetFailure) return failure(state, targetFailure);
  const normalizedDate = normalizeDatedTrainingActionDate(targetDate);
  if (!normalizedDate) return failure(state, "La fecha no es válida.");
  const wodId = uniqueId(state.wods, id);
  if (!wodId) return failure(state, "Identificador de rutina inválido.");
  const copied: GymTrainingWod = { id: wodId, date: normalizedDate, title: source.title, content: source.content, teacherId: authorized.actor!.id, ...targetFields(resolved.target) };
  return transition({ ...state, wods: [...state.wods, copied] }, Object.freeze({ success: true, wodId }));
}

export function createGymTrainingGroup(state: GymTrainingDemoState, actorToken: unknown, id: unknown, name: unknown): GymTrainingTransition<GymTrainingGroupResult> {
  const authorized = authorizedState<GymTrainingGroupResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  if (typeof name !== "string" || !name.trim()) return failure(state, "El nombre del grupo no puede estar vacío.");
  const trimmed = name.trim();
  if (groupNameTaken(state, authorized.actor!.id, trimmed)) return failure(state, "Ya tenés un grupo con ese nombre.");
  const groupId = uniqueId(state.groups, id);
  if (!groupId) return failure(state, "Identificador de grupo inválido.");
  return transition({ ...state, groups: [...state.groups, { id: groupId, name: trimmed, teacherId: authorized.actor!.id, deletedAt: null }] }, Object.freeze({ success: true, groupId }));
}

export function renameGymTrainingGroup(state: GymTrainingDemoState, actorToken: unknown, groupId: unknown, name: unknown): GymTrainingTransition<GymTrainingGroupResult> {
  const authorized = authorizedState<GymTrainingGroupResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  const group = typeof groupId === "string" ? activeGroup(state, groupId) : null;
  if (!group || !canManageGroup(authorized.actor!, group)) return failure(state, "Grupo no encontrado.");
  if (typeof name !== "string" || !name.trim()) return failure(state, "El nombre del grupo no puede estar vacío.");
  const trimmed = name.trim();
  if (groupNameTaken(state, group.teacherId, trimmed, group.id)) return failure(state, "Ya existe un grupo con ese nombre.");
  return transition({ ...state, groups: state.groups.map((candidate) => candidate.id === group.id ? { ...candidate, name: trimmed } : candidate) }, Object.freeze({ success: true }));
}

export function deleteGymTrainingGroup(state: GymTrainingDemoState, actorToken: unknown, groupId: unknown, deletedAt: unknown): GymTrainingTransition<GymTrainingGroupResult> {
  const authorized = authorizedState<GymTrainingGroupResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  const group = typeof groupId === "string" ? activeGroup(state, groupId) : null;
  if (!group || !canManageGroup(authorized.actor!, group)) return failure(state, "Grupo no encontrado.");
  if (!isDatedTrainingInstant(deletedAt)) return failure(state, "La fecha de eliminación no es válida.");
  const detached = detachDatedTrainingGroup(state.groups, state.memberships, state.wods, group.id, deletedAt);
  return transition({ ...state, ...detached }, Object.freeze({ success: true }));
}

export function assignGymTrainingStudentToGroup(state: GymTrainingDemoState, actorToken: unknown, studentId: unknown, groupId: unknown): GymTrainingTransition<GymTrainingGroupResult> {
  const authorized = authorizedState<GymTrainingGroupResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  const group = typeof groupId === "string" ? activeGroup(state, groupId) : null;
  if (!group || !canManageGroup(authorized.actor!, group)) return failure(state, "Grupo no encontrado.");
  const student = typeof studentId === "string" ? activeStudent(studentId) : null;
  if (!student) return failure(state, "Alumno no encontrado.");
  if (student.studentType !== "PERSONALIZED" && student.studentType !== "MUSCULACION_LIBRE") return failure(state, "Solo alumnos personalizados o de musculación libre pueden pertenecer a un grupo.");
  if (authorized.actor!.role !== "ADMIN" && student.studentType !== "MUSCULACION_LIBRE" && !linked(authorized.actor!.id, student.id)) return failure(state, "Este alumno no está asignado a vos.");
  if (state.memberships.some((membership) => membership.groupId === group.id && membership.studentId === student.id)) return transition(state, Object.freeze({ success: true }));
  return transition({ ...state, memberships: [...state.memberships, { groupId: group.id, studentId: student.id }] }, Object.freeze({ success: true }));
}

export function removeGymTrainingStudentFromGroup(state: GymTrainingDemoState, actorToken: unknown, studentId: unknown, groupId: unknown): GymTrainingTransition<GymTrainingGroupResult> {
  const authorized = authorizedState<GymTrainingGroupResult>(state, actorToken);
  if (authorized.invalid) return authorized.invalid;
  const group = typeof groupId === "string" ? activeGroup(state, groupId) : null;
  if (!group || !canManageGroup(authorized.actor!, group)) return failure(state, "Grupo no encontrado.");
  if (typeof studentId !== "string") return failure(state, "Alumno no encontrado.");
  const next = state.memberships.filter((membership) => membership.groupId !== group.id || membership.studentId !== studentId);
  return transition(next.length === state.memberships.length ? state : { ...state, memberships: next }, Object.freeze({ success: true }));
}

/** Auth is intentionally resolved before state validation and before groupId is inspected. */
export function resolveGymFixedGroupAssignment(state: unknown, actorToken: unknown, groupId: unknown): GymFixedGroupAssignment {
  const actor = resolveGymDemoActor(actorToken);
  if (!actor || !isStaff(actor)) return Object.freeze({ success: false, error: "No autorizado." });
  if (!isValidGymTrainingDemoState(state)) return Object.freeze({ success: false, error: "El estado de entrenamiento no es válido." });
  if (!isDatedTrainingId(groupId)) return Object.freeze({ success: false, error: "Grupo no encontrado." });
  const group = activeGroup(state, groupId);
  if (!group) return Object.freeze({ success: false, error: "Grupo no encontrado." });
  if (actor.role === "TEACHER" && group.teacherId !== actor.id) return Object.freeze({ success: false, error: "No autorizado para este grupo." });
  if (actor.role === "ADMIN" && !activeStaff(group.teacherId)) return Object.freeze({ success: false, error: "Grupo no encontrado." });
  const eligibleStudentIds = state.memberships
    .filter((membership) => membership.groupId === group.id)
    .map((membership) => activeStudent(membership.studentId))
    .filter((student): student is Readonly<GymDemoProfile> => !!student && student.studentType === "MUSCULACION_LIBRE")
    .map((student) => student.id);
  if (eligibleStudentIds.length === 0) return Object.freeze({ success: false, error: "El grupo no tiene alumnos de musculación libre." });
  return Object.freeze({ success: true, groupId: group.id, teacherId: group.teacherId, eligibleStudentIds: Object.freeze([...eligibleStudentIds]) });
}

export function projectGymTrainingViews(state: unknown, actorToken: unknown): GymTrainingProjection {
  const actor = resolveGymDemoActor(actorToken);
  if (!actor) return projectionFailure("No autorizado.");
  if (!isValidGymTrainingDemoState(state)) return projectionFailure("El estado de entrenamiento no es válido.");
  const profile = directoryProfile(actor.id);
  if (!profile) return projectionFailure("No autorizado.");
  const activeGroups = state.groups.filter((group) => group.deletedAt === null);
  const groupName = (groupId: string | null) => activeGroups.find((group) => group.id === groupId)?.name ?? null;
  const studentName = (studentId: string | null) => studentId === null ? null : directoryProfile(studentId)?.name ?? null;
  const ownStaffGroups = isStaff(actor)
    ? activeGroups.filter((group) => group.teacherId === actor.id).sort((left, right) => GYM_GROUP_NAME_COLLATOR.compare(left.name, right.name))
    : [];
  const linkedPersonalized = directoryProfiles.filter((candidate) => candidate.deletedAt === null && candidate.role === "STUDENT" && candidate.studentType === "PERSONALIZED" && linked(actor.id, candidate.id));
  const groupCandidates = directoryProfiles.filter((candidate) => candidate.deletedAt === null && candidate.role === "STUDENT" && (candidate.studentType === "PERSONALIZED" || candidate.studentType === "MUSCULACION_LIBRE") && (candidate.studentType === "MUSCULACION_LIBRE" ? actor.role === "ADMIN" || linked(actor.id, candidate.id) : linked(actor.id, candidate.id)));
  const groupRows = ownStaffGroups.map((group) => {
    const memberIds = new Set(state.memberships.filter((membership) => membership.groupId === group.id).map((membership) => membership.studentId));
    const row = {
      id: group.id,
      name: group.name,
      // Persisted memberships are projected independently from the assignment picker: an ADMIN may have assigned an unlinked PERSONALIZED student.
      students: Object.freeze(state.memberships.filter((membership) => membership.groupId === group.id).map((membership) => directoryProfile(membership.studentId)).filter((candidate): candidate is Readonly<GymDemoProfile> => candidate !== null).map((candidate) => frozenDatedTrainingSnapshot({ id: candidate.id, name: candidate.name }))),
      availableToAdd: Object.freeze(groupCandidates.filter((candidate) => !memberIds.has(candidate.id)).map((candidate) => frozenDatedTrainingSnapshot({ id: candidate.id, name: candidate.name }))),
    };
    return Object.freeze(row);
  });
  const studentWods = actor.role !== "STUDENT" || actor.studentType === "MUSCULACION_LIBRE"
    ? []
    : state.wods.filter((wod) => {
        if (!linked(wod.teacherId, actor.id)) return false;
        if (wod.targetType === "ALL") return true;
        if (actor.studentType !== "PERSONALIZED") return false;
        return wod.targetType === "PERSONALIZED" || (wod.targetType === "GROUP" && wod.targetGroupId !== null && state.memberships.some((membership) => membership.groupId === wod.targetGroupId && membership.studentId === actor.id)) || (wod.targetType === "STUDENT" && wod.targetStudentId === actor.id);
      }).map((wod) => Object.freeze({ id: wod.id, title: wod.title, content: wod.content, date: wod.date, teacherId: wod.teacherId, targetType: wod.targetType, targetGroupName: groupName(wod.targetGroupId), isOwn: false }));
  return Object.freeze({
    success: true,
    actorId: actor.id,
    staff: Object.freeze({
      wods: Object.freeze((isStaff(actor) ? state.wods.filter((wod) => wod.teacherId === actor.id).sort(byDatedWodDescending) : []).map((wod) => Object.freeze({ ...wod, targetGroupName: groupName(wod.targetGroupId), targetStudentName: studentName(wod.targetStudentId) }))),
      groups: Object.freeze(groupRows),
      students: Object.freeze(linkedPersonalized.map((candidate) => frozenDatedTrainingSnapshot({ id: candidate.id, name: candidate.name }))),
    }),
    student: Object.freeze({ wods: Object.freeze(studentWods.sort(byDatedWodDescending)) }),
  });
}

/** Reset owns only this dated GYM ledger and never recreates canonical directory values. */
export function resetGymTrainingDemoState(): GymTrainingDemoState {
  return createGymTrainingDemoFixture();
}
