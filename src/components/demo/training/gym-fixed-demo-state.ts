// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_FIXED_DEMO_GYM_ID, createGymFixedDemoFixture, getGymFixedDemoGroupMemberships, getGymFixedDemoGroups, getGymFixedDemoRoster, getGymFixedDemoTeacherStudentLinks } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_FIXED_DEMO_NAMESPACE, GYM_FIXED_DEMO_VERSION } from "./gym-fixed-demo-types.ts";
import type {
  GymFixedDemoAssignmentContext,
  GymFixedDemoCreateCommand,
  GymFixedDemoCreateGroupCommand,
  GymFixedDemoDeleteCommand,
  GymFixedDemoGroupResult,
  GymFixedDemoGroup,
  GymFixedDemoRenewCommand,
  GymFixedDemoRenewalDto,
  GymFixedDemoResult,
  GymFixedDemoRosterRecord,
  GymFixedDemoRoutine,
  GymFixedDemoState,
  GymFixedDemoStudentRoutineDto,
  GymFixedDemoTransition,
  GymFixedDemoUpdateCommand,
} from "./gym-fixed-demo-types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * The fixture module returns detached data. This private snapshot is frozen and
 * is the only authority source; payload roles, fixture mutations, and state
 * fields cannot add a capability.
 */
const roster = Object.freeze(getGymFixedDemoRoster().map((record) => Object.freeze({ ...record })));
const teacherStudentLinks = Object.freeze(getGymFixedDemoTeacherStudentLinks().map((link) => Object.freeze({ ...link })));
const groups = Object.freeze(getGymFixedDemoGroups().map((group) => Object.freeze({ ...group })));
const memberships = Object.freeze(getGymFixedDemoGroupMemberships().map((membership) => Object.freeze({ ...membership })));
const rosterById = new Map(roster.map((record) => [record.id, record]));
const groupById = new Map(groups.map((group) => [group.id, group]));

function safe<T>(callback: () => T): T | null {
  try { return callback(); } catch { return null; }
}

/** Rejects symbols, accessors, inherited fields, null prototypes, and unknown keys. */
function exactRecord(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
  return safe(() => {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const allowed = [...required, ...optional];
    const own = Reflect.ownKeys(value);
    if (own.length < required.length || own.length > allowed.length || !own.every((key) => typeof key === "string" && allowed.includes(key))) return null;
    if (!required.every((key) => own.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of own) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    }
    return Object.fromEntries(own.map((key) => [key, descriptors[key as string]!.value]));
  });
}

/** Arrays at this boundary must be native, dense, enumerable value rows only. */
function denseArray(value: unknown): unknown[] | null {
  return safe(() => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !("value" in length) || !Number.isSafeInteger(length.value) || length.value < 0 || length.enumerable) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== length.value + 1 || !own.every((key) => key === "length" || (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
      result.push(descriptor.value);
    }
    return result;
  });
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Avoids Date.UTC's 1900 offset for years 0000–0099. */
function calendarDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

export function isGymFixedDemoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = calendarDate(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function isGymFixedDemoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return calendarDate(year, month - 1, day);
}

function dateKey(date: Date): string {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

function defaultRenewAt(assignedAt: Date): string {
  return dateKey(new Date(assignedAt.getTime() + 30 * DAY_MS));
}

function canonicalActor(value: unknown): GymFixedDemoRosterRecord | null {
  return roster.find((actor) => actor === value) ?? null;
}

/** Returns a detached UI identity, never the private capability token. */
export function getGymFixedDemoActor(actorId: unknown): GymFixedDemoRosterRecord | null {
  if (!isId(actorId)) return null;
  const actor = rosterById.get(actorId);
  return actor ? { ...actor } : null;
}

/** Injectable demo adapters may retain this opaque canonical reference, never reconstruct it from a payload. */
export function getGymFixedDemoActorToken(actorId: unknown): unknown {
  if (!isId(actorId)) return null;
  return rosterById.get(actorId) ?? null;
}

function routineRecord(value: unknown): GymFixedDemoRoutine | null {
  const record = exactRecord(value, ["id", "gymId", "studentId", "teacherId", "title", "content", "assignedAt", "renewAt", "deletedAt"]);
  if (!record || !isId(record.id) || record.gymId !== GYM_FIXED_DEMO_GYM_ID || !isId(record.studentId) || !isId(record.teacherId)
    || !isId(record.title) || typeof record.content !== "string" || !record.content.trim() || !isGymFixedDemoInstant(record.assignedAt)
    || !isGymFixedDemoDate(record.renewAt) || (record.deletedAt !== null && !isGymFixedDemoInstant(record.deletedAt))) return null;
  const student = rosterById.get(record.studentId);
  const teacher = rosterById.get(record.teacherId);
  if (!student || student.gymId !== GYM_FIXED_DEMO_GYM_ID || student.role !== "STUDENT") return null;
  if (!teacher || teacher.gymId !== GYM_FIXED_DEMO_GYM_ID || (teacher.role !== "ADMIN" && teacher.role !== "TEACHER")) return null;
  return record as GymFixedDemoRoutine;
}

/** Adapter-ready closed validation for versioned storage; no storage is implemented in this unit. */
export function isValidGymFixedDemoState(value: unknown): value is GymFixedDemoState {
  const record = exactRecord(value, ["version", "namespace", "fixedRoutines"]);
  if (!record || record.version !== GYM_FIXED_DEMO_VERSION || record.namespace !== GYM_FIXED_DEMO_NAMESPACE) return false;
  const routines = denseArray(record.fixedRoutines);
  if (!routines) return false;
  const ids = new Set<string>();
  for (const routine of routines) {
    const valid = routineRecord(routine);
    if (!valid || ids.has(valid.id)) return false;
    ids.add(valid.id);
  }
  return true;
}

function failure<R extends { success: false; error: string }>(state: GymFixedDemoState, error: string): GymFixedDemoTransition<R> {
  return { state, result: { success: false, error } as R };
}

function success(state: GymFixedDemoState, id?: string): GymFixedDemoTransition<GymFixedDemoResult> {
  return { state, result: id === undefined ? { success: true } : { success: true, id } };
}

function staff(actor: GymFixedDemoRosterRecord): boolean {
  return actor.role === "ADMIN" || actor.role === "TEACHER";
}

function activeStudent(studentId: string): GymFixedDemoRosterRecord | null {
  const student = rosterById.get(studentId);
  return student && student.gymId === GYM_FIXED_DEMO_GYM_ID && student.role === "STUDENT" && student.deletedAt === null ? student : null;
}

function linked(teacherId: string, studentId: string): boolean {
  return teacherStudentLinks.some((link) => link.teacherId === teacherId && link.studentId === studentId);
}

function resolveCreate(value: unknown): GymFixedDemoCreateCommand | null {
  const command = exactRecord(value, ["id", "studentId", "title", "content"], ["renewAt"]);
  if (!command || !isId(command.id) || !isId(command.studentId) || typeof command.title !== "string" || typeof command.content !== "string") return null;
  if (command.renewAt !== undefined && typeof command.renewAt !== "string") return null;
  return command as GymFixedDemoCreateCommand;
}

function resolveUpdate(value: unknown): GymFixedDemoUpdateCommand | null {
  const command = exactRecord(value, ["routineId", "title", "content"], ["renewAt"]);
  if (!command || !isId(command.routineId) || typeof command.title !== "string" || typeof command.content !== "string") return null;
  if (command.renewAt !== undefined && typeof command.renewAt !== "string") return null;
  return command as GymFixedDemoUpdateCommand;
}

function resolveRenew(value: unknown): GymFixedDemoRenewCommand | null {
  const command = exactRecord(value, ["routineId", "renewAt"]);
  return command && isId(command.routineId) && typeof command.renewAt === "string" ? command as GymFixedDemoRenewCommand : null;
}

function resolveDelete(value: unknown): GymFixedDemoDeleteCommand | null {
  const command = exactRecord(value, ["routineId"]);
  return command && isId(command.routineId) ? command as GymFixedDemoDeleteCommand : null;
}

function resolveGroupCreate(value: unknown): GymFixedDemoCreateGroupCommand | null {
  const command = exactRecord(value, ["groupId", "ids", "title", "content"], ["renewAt"]);
  if (!command || !isId(command.groupId) || typeof command.title !== "string" || typeof command.content !== "string" || (command.renewAt !== undefined && typeof command.renewAt !== "string")) return null;
  const ids = denseArray(command.ids);
  if (!ids || !ids.every(isId)) return null;
  return { ...command, ids: [...ids] as string[] } as GymFixedDemoCreateGroupCommand;
}

function validContent(title: string, content: string): { title: string; content: string } | null {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (!trimmedTitle || !trimmedContent) return null;
  return { title: trimmedTitle, content: trimmedContent };
}

/**
 * The actions use new Date(`${renewAtStr.trim()}T00:00:00.000Z`) plus isNaN,
 * so overflow calendar input is accepted then persisted as its normalized date.
 * The ledger remains canonical because only the resulting calendar key is stored.
 */
function parseCommandRenewAt(value: string): string | null {
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed);
}

function resolveRenewAt(value: string | undefined, assignedAt: Date): string | null {
  if (value === undefined || !value.trim()) return defaultRenewAt(assignedAt);
  return parseCommandRenewAt(value);
}

/** updateFixedRoutine preserves renewAt for omitted or blank input. */
function resolveOptionalRenewAt(value: string | undefined): string | undefined | null {
  if (value === undefined || !value.trim()) return undefined;
  return parseCommandRenewAt(value);
}

function trustedNow(value: unknown): Date | null {
  if (typeof value !== "function") return null;
  try {
    const now = value();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null;
    const copy = new Date(now.getTime());
    return copy.toISOString() ? copy : null;
  } catch {
    return null;
  }
}

function activeGymRoutine(state: GymFixedDemoState, routineId: string): GymFixedDemoRoutine | null {
  return state.fixedRoutines.find((candidate) => candidate.id === routineId && candidate.gymId === GYM_FIXED_DEMO_GYM_ID && candidate.deletedAt === null) ?? null;
}

function ownershipError(actor: GymFixedDemoRosterRecord, routine: GymFixedDemoRoutine): string | null {
  return actor.role === "TEACHER" && routine.teacherId !== actor.id ? "No autorizado." : null;
}

type GymFixedDemoGroupEligibility =
  | { success: true; studentIds: string[] }
  | { success: false; error: string };

/**
 * Resolves the exact group batch selection used by the mutation: canonical
 * staff only, existing group ownership checks, then active MUSCULACION_LIBRE
 * members in fixture membership order. Returned IDs are detached data.
 */
function resolveGymFixedDemoGroupScope(
  actor: GymFixedDemoRosterRecord,
  groupId: string,
): { success: true; group: GymFixedDemoGroup } | { success: false; error: string } {
  const group = groupById.get(groupId);
  if (!group || group.deletedAt !== null) return { success: false, error: "Grupo no encontrado." };
  if (actor.role === "TEACHER" && group.teacherId !== actor.id) return { success: false, error: "No autorizado para este grupo." };
  const groupTeacher = rosterById.get(group.teacherId);
  if (actor.role === "ADMIN" && (!groupTeacher || groupTeacher.gymId !== GYM_FIXED_DEMO_GYM_ID || groupTeacher.deletedAt !== null)) {
    return { success: false, error: "Grupo no encontrado." };
  }
  return { success: true, group };
}

/** One membership-order selection rule, shared by the action mirror and adapter context. */
function resolveGymFixedDemoGroupEligibility(group: GymFixedDemoGroup): GymFixedDemoGroupEligibility {
  const studentIds = memberships
    .filter((membership) => membership.groupId === group.id)
    .map((membership) => activeStudent(membership.studentId))
    .filter((student): student is GymFixedDemoRosterRecord => !!student && student.studentType === "MUSCULACION_LIBRE")
    .map((student) => student.id);
  return studentIds.length > 0
    ? { success: true, studentIds }
    : { success: false, error: "El grupo no tiene alumnos de musculación libre." };
}

/**
 * Adapter-only allocation context. Authorization is checked before examining
 * the supplied group input, and no membership rows are exposed on denial.
 */
export function getGymFixedDemoGroupEligibility(
  actorInput: unknown,
  groupInput: unknown,
): GymFixedDemoGroupEligibility {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return { success: false, error: "No autorizado." };
  if (!isId(groupInput)) return { success: false, error: "Grupo no encontrado." };
  const scope = resolveGymFixedDemoGroupScope(actor, groupInput);
  if (!scope.success) return scope;
  const resolved = resolveGymFixedDemoGroupEligibility(scope.group);
  return resolved.success ? { success: true, studentIds: [...resolved.studentIds] } : resolved;
}

/** Mirrors createFixedRoutine; GENERAL and PERSONALIZED are valid individual targets, while LITE is not. */
export function createGymFixedRoutine(
  state: GymFixedDemoState,
  actorInput: unknown,
  rawCommand: unknown,
  now: unknown,
): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveCreate(rawCommand);
  if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const student = activeStudent(command.studentId);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (student.accountKind === "LITE") return failure(state, "No se puede asignar rutina fija a un alumno lite.");
  if (actor.role === "TEACHER" && !linked(actor.id, student.id)) return failure(state, "Alumno no asignado a vos.");
  const fields = validContent(command.title, command.content);
  if (!fields) return failure(state, !command.title.trim() ? "El título es obligatorio." : "El contenido es obligatorio.");
  if (state.fixedRoutines.some((routine) => routine.id === command.id)) return failure(state, "Identificador de rutina inválido.");
  const assigned = trustedNow(now);
  if (!assigned) return failure(state, "La hora de confianza no es válida.");
  const renewAt = resolveRenewAt(command.renewAt, assigned);
  if (!renewAt) return failure(state, "Fecha de renovación inválida.");
  const routine: GymFixedDemoRoutine = {
    id: command.id, gymId: GYM_FIXED_DEMO_GYM_ID, studentId: student.id, teacherId: actor.id,
    title: fields.title, content: fields.content, assignedAt: assigned.toISOString(), renewAt, deletedAt: null,
  };
  return success({ ...state, fixedRoutines: [...state.fixedRoutines, routine] }, routine.id);
}

/** Mirrors updateFixedRoutine: teachers only edit their own active routine; ADMIN may edit another teacher's. */
export function updateGymFixedRoutine(state: GymFixedDemoState, actorInput: unknown, rawCommand: unknown): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveUpdate(rawCommand);
  if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const routine = activeGymRoutine(state, command.routineId);
  if (!routine) return failure(state, "Rutina no encontrada.");
  const denied = ownershipError(actor, routine);
  if (denied) return failure(state, denied);
  const fields = validContent(command.title, command.content);
  if (!fields) return failure(state, !command.title.trim() ? "El título es obligatorio." : "El contenido es obligatorio.");
  const parsedRenewAt = resolveOptionalRenewAt(command.renewAt);
  if (parsedRenewAt === null) return failure(state, "Fecha de renovación inválida.");
  const renewAt = parsedRenewAt ?? routine.renewAt;
  return success({ ...state, fixedRoutines: state.fixedRoutines.map((candidate) => candidate.id === routine.id ? { ...candidate, ...fields, renewAt } : candidate) });
}

/** Serialized date adapter for updateFixedRoutineRenewAt's Date argument. */
export function renewGymFixedRoutine(state: GymFixedDemoState, actorInput: unknown, rawCommand: unknown): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveRenew(rawCommand);
  if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const routine = activeGymRoutine(state, command.routineId);
  if (!routine) return failure(state, "Rutina no encontrada.");
  const denied = ownershipError(actor, routine);
  if (denied) return failure(state, denied);
  const renewAt = parseCommandRenewAt(command.renewAt);
  if (!renewAt) return failure(state, "Fecha de renovación inválida.");
  return success({ ...state, fixedRoutines: state.fixedRoutines.map((candidate) => candidate.id === routine.id ? { ...candidate, renewAt } : candidate) });
}

/** The live delete action omits a repeated kind query; this closed GYM-only namespace enforces that boundary without changing production. */
export function deleteGymFixedRoutine(state: GymFixedDemoState, actorInput: unknown, rawCommand: unknown, now: unknown): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveDelete(rawCommand);
  if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const routine = activeGymRoutine(state, command.routineId);
  if (!routine) return failure(state, "Rutina no encontrada.");
  const denied = ownershipError(actor, routine);
  if (denied) return failure(state, denied);
  const deleted = trustedNow(now);
  if (!deleted) return failure(state, "La hora de confianza no es válida.");
  return success({ ...state, fixedRoutines: state.fixedRoutines.map((candidate) => candidate.id === routine.id ? { ...candidate, deletedAt: deleted.toISOString() } : candidate) });
}

/** Mirrors createFixedRoutineForGroup, including its source asymmetry: active MUSCULACION_LIBRE LITE members are included. */
export function createGymFixedRoutineForGroup(
  state: GymFixedDemoState,
  actorInput: unknown,
  rawCommand: unknown,
  now: unknown,
): GymFixedDemoTransition<GymFixedDemoGroupResult> {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveGroupCreate(rawCommand);
  if (!command) return failure(state, "La rutina de grupo no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const scope = resolveGymFixedDemoGroupScope(actor, command.groupId);
  if (!scope.success) return failure(state, scope.error);
  const fields = validContent(command.title, command.content);
  if (!fields) return failure(state, !command.title.trim() ? "El título es obligatorio." : "El contenido es obligatorio.");
  const eligibility = resolveGymFixedDemoGroupEligibility(scope.group);
  if (!eligibility.success) return failure(state, eligibility.error);
  if (command.ids.length !== eligibility.studentIds.length || new Set(command.ids).size !== command.ids.length || command.ids.some((id) => state.fixedRoutines.some((routine) => routine.id === id))) {
    return failure(state, "Identificadores de rutina inválidos.");
  }
  const assigned = trustedNow(now);
  if (!assigned) return failure(state, "La hora de confianza no es válida.");
  const renewAt = resolveRenewAt(command.renewAt, assigned);
  if (!renewAt) return failure(state, "Fecha de renovación inválida.");
  const created = eligibility.studentIds.map((studentId, index): GymFixedDemoRoutine => ({
    id: command.ids[index]!, gymId: GYM_FIXED_DEMO_GYM_ID, studentId, teacherId: actor.id,
    title: fields.title, content: fields.content, assignedAt: assigned.toISOString(), renewAt, deletedAt: null,
  }));
  return { state: { ...state, fixedRoutines: [...state.fixedRoutines, ...created] }, result: { success: true, count: created.length } };
}

function compareActive(left: GymFixedDemoRoutine, right: GymFixedDemoRoutine): number {
  if (left.assignedAt !== right.assignedAt) return left.assignedAt > right.assignedAt ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function activeRoutineForStudent(state: GymFixedDemoState, studentId: string): GymFixedDemoRoutine | null {
  return state.fixedRoutines.filter((routine) => routine.studentId === studentId && routine.deletedAt === null).sort(compareActive)[0] ?? null;
}

/** Mirrors the athlete consumer: only a full MUSCULACION_LIBRE student's latest non-deleted routine is visible. */
export function projectGymFixedStudentRoutine(state: GymFixedDemoState, actorInput: unknown): GymFixedDemoStudentRoutineDto | null {
  const actor = canonicalActor(actorInput);
  if (!actor || actor.role !== "STUDENT" || actor.studentType !== "MUSCULACION_LIBRE" || actor.accountKind !== "FULL") return null;
  if (!isValidGymFixedDemoState(state)) return null;
  const routine = activeRoutineForStudent(state, actor.id);
  if (!routine) return null;
  const teacher = rosterById.get(routine.teacherId);
  return { id: routine.id, title: routine.title, content: routine.content, assignedAt: new Date(routine.assignedAt), renewAt: dateFromKey(routine.renewAt), teacherName: teacher?.name ?? null };
}

/** Mirrors the teacher page's GYM assignment context: admin sees all active muslib students, teachers only their links. */
export function projectGymFixedAssignmentContext(state: GymFixedDemoState, actorInput: unknown): GymFixedDemoAssignmentContext | null {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return null;
  if (!isValidGymFixedDemoState(state)) return null;
  const muslibStudents = roster
    .filter((student) => student.gymId === GYM_FIXED_DEMO_GYM_ID && student.role === "STUDENT" && student.deletedAt === null && student.studentType === "MUSCULACION_LIBRE" && (actor.role === "ADMIN" || linked(actor.id, student.id)))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((student) => ({ id: student.id, name: student.name, accountKind: student.accountKind }));
  const ownedGroups = groups
    .filter((group) => group.deletedAt === null && group.teacherId === actor.id)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((group) => ({ id: group.id, name: group.name }));
  return { muslibStudents, groups: ownedGroups };
}

/** Mirrors getTeacherRenewalRoutines/getGymRenewalRoutines: due through seven UTC calendar days, one latest-renewAt row per student. */
export function projectGymFixedRenewals(state: GymFixedDemoState, actorInput: unknown, today: unknown): GymFixedDemoRenewalDto[] | null {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return null;
  if (!isGymFixedDemoDate(today) || !isValidGymFixedDemoState(state)) return null;
  const sevenDaysOut = dateKey(new Date(dateFromKey(today).getTime() + 7 * DAY_MS));
  // Prisma supplies renewAt ASC. Map replacement keeps the first insertion slot.
  const sourceOrder = state.fixedRoutines
    .map((routine, index) => ({ routine, index }))
    .filter(({ routine }) => routine.deletedAt === null && routine.renewAt <= sevenDaysOut && (actor.role !== "TEACHER" || routine.teacherId === actor.id))
    .sort((left, right) => left.routine.renewAt === right.routine.renewAt ? left.index - right.index : left.routine.renewAt.localeCompare(right.routine.renewAt));
  const byStudent = new Map<string, GymFixedDemoRoutine>();
  for (const { routine } of sourceOrder) {
    const existing = byStudent.get(routine.studentId);
    if (!existing || routine.renewAt > existing.renewAt) byStudent.set(routine.studentId, routine);
  }
  return [...byStudent.values()]
    .map((routine) => ({ id: routine.id, studentId: routine.studentId, studentName: rosterById.get(routine.studentId)?.name ?? "", renewAt: dateFromKey(routine.renewAt), overdue: routine.renewAt < today }));
}

/** Reset restores only this deterministic GYM ledger; it cannot touch BOX, finance, access, or storage. */
export function resetGymFixedDemoState(): GymFixedDemoState {
  return createGymFixedDemoFixture();
}
