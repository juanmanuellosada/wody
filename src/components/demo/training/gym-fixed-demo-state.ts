// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_FIXED_DEMO_GYM_ID, createGymFixedDemoFixture } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_FIXED_DEMO_NAMESPACE, GYM_FIXED_DEMO_VERSION } from "./gym-fixed-demo-types.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getGymDemoActorToken, getGymDemoProfile, getGymDemoProfiles, getGymDemoTeacherStudentLinks, resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { projectGymTrainingViews, resolveGymFixedGroupAssignment, resolveGymFixedGroupScope } from "./gym-training-demo-state.ts";
import type {
  GymFixedDemoAssignmentContext,
  GymFixedDemoCreateCommand,
  GymFixedDemoCreateGroupCommand,
  GymFixedDemoDeleteCommand,
  GymFixedDemoGroupResult,
  GymFixedDemoRenewCommand,
  GymFixedDemoRenewalDto,
  GymFixedDemoResult,
  GymFixedDemoRoutine,
  GymFixedDemoState,
  GymFixedDemoStudentRoutineDto,
  GymFixedDemoTransition,
  GymFixedDemoUpdateCommand,
} from "./gym-fixed-demo-types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_MS = 24 * 60 * 60 * 1000;

type CanonicalActor = NonNullable<ReturnType<typeof resolveGymDemoActor>>;
type GroupEligibility = { success: true; studentIds: string[] } | { success: false; error: string };

function safe<T>(callback: () => T): T | null {
  try { return callback(); } catch { return null; }
}

/** Rejects symbols, accessors, inherited fields, null prototypes, and unknown keys. */
function exactRecord(value: unknown, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> | null {
  return safe(() => {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const allowed = [...required, ...optional];
    const own = Reflect.ownKeys(value);
    if (own.length < required.length || own.length > allowed.length || !own.every((key) => typeof key === "string" && allowed.includes(key)) || !required.every((key) => own.includes(key))) return null;
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

function isId(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function calendarDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0); date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(year, monthIndex, day); return date;
}
export function isGymFixedDemoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = calendarDate(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}
export function isGymFixedDemoInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const date = new Date(value); return Number.isFinite(date.getTime()) && date.toISOString() === value;
}
function dateFromKey(value: string): Date { const [year, month, day] = value.split("-").map(Number); return calendarDate(year, month - 1, day); }
function dateKey(date: Date): string { return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`; }
function defaultRenewAt(assignedAt: Date): string { return dateKey(new Date(assignedAt.getTime() + 30 * DAY_MS)); }

/** Canonical directory identity only; no fixed fixture token or caller profile can authorize. */
function canonicalActor(value: unknown): CanonicalActor | null { return resolveGymDemoActor(value); }
export function getGymFixedDemoActor(actorId: unknown) { return getGymDemoProfile(actorId); }
/** Trusted fixture composition, not authentication: delegates to the canonical directory token. */
export function getGymFixedDemoActorToken(actorId: unknown): unknown { return getGymDemoActorToken(actorId); }
function staff(actor: CanonicalActor): boolean { return actor.role === "ADMIN" || actor.role === "TEACHER"; }
function profile(id: string) { return getGymDemoProfile(id); }
function activeStudent(studentId: string) {
  const student = profile(studentId);
  return student && student.gymId === GYM_FIXED_DEMO_GYM_ID && student.role === "STUDENT" && student.deletedAt === null ? student : null;
}
function linked(teacherId: string, studentId: string): boolean { return getGymDemoTeacherStudentLinks().some((link) => link.teacherId === teacherId && link.studentId === studentId); }

function routineRecord(value: unknown): GymFixedDemoRoutine | null {
  const record = exactRecord(value, ["id", "gymId", "studentId", "teacherId", "title", "content", "assignedAt", "renewAt", "deletedAt"]);
  if (!record || !isId(record.id) || record.gymId !== GYM_FIXED_DEMO_GYM_ID || !isId(record.studentId) || !isId(record.teacherId) || !isId(record.title) || typeof record.content !== "string" || !record.content.trim() || !isGymFixedDemoInstant(record.assignedAt) || !isGymFixedDemoDate(record.renewAt) || (record.deletedAt !== null && !isGymFixedDemoInstant(record.deletedAt))) return null;
  const student = profile(record.studentId);
  const teacher = profile(record.teacherId);
  if (!student || student.gymId !== GYM_FIXED_DEMO_GYM_ID || student.role !== "STUDENT" || !teacher || teacher.gymId !== GYM_FIXED_DEMO_GYM_ID || (teacher.role !== "ADMIN" && teacher.role !== "TEACHER")) return null;
  return record as GymFixedDemoRoutine;
}
export function isValidGymFixedDemoState(value: unknown): value is GymFixedDemoState {
  const record = exactRecord(value, ["version", "namespace", "fixedRoutines"]);
  if (!record || record.version !== GYM_FIXED_DEMO_VERSION || record.namespace !== GYM_FIXED_DEMO_NAMESPACE) return false;
  const routines = denseArray(record.fixedRoutines);
  if (!routines) return false;
  const ids = new Set<string>();
  for (const routine of routines) { const valid = routineRecord(routine); if (!valid || ids.has(valid.id)) return false; ids.add(valid.id); }
  return true;
}
function failure<R extends { success: false; error: string }>(state: GymFixedDemoState, error: string): GymFixedDemoTransition<R> { return { state, result: { success: false, error } as R }; }
function success(state: GymFixedDemoState, id?: string): GymFixedDemoTransition<GymFixedDemoResult> { return { state, result: id === undefined ? { success: true } : { success: true, id } }; }
function resolveCreate(value: unknown): GymFixedDemoCreateCommand | null { const command = exactRecord(value, ["id", "studentId", "title", "content"], ["renewAt"]); return command && isId(command.id) && isId(command.studentId) && typeof command.title === "string" && typeof command.content === "string" && (command.renewAt === undefined || typeof command.renewAt === "string") ? command as GymFixedDemoCreateCommand : null; }
function resolveUpdate(value: unknown): GymFixedDemoUpdateCommand | null { const command = exactRecord(value, ["routineId", "title", "content"], ["renewAt"]); return command && isId(command.routineId) && typeof command.title === "string" && typeof command.content === "string" && (command.renewAt === undefined || typeof command.renewAt === "string") ? command as GymFixedDemoUpdateCommand : null; }
function resolveRenew(value: unknown): GymFixedDemoRenewCommand | null { const command = exactRecord(value, ["routineId", "renewAt"]); return command && isId(command.routineId) && typeof command.renewAt === "string" ? command as GymFixedDemoRenewCommand : null; }
function resolveDelete(value: unknown): GymFixedDemoDeleteCommand | null { const command = exactRecord(value, ["routineId"]); return command && isId(command.routineId) ? command as GymFixedDemoDeleteCommand : null; }
function resolveGroupCreate(value: unknown): GymFixedDemoCreateGroupCommand | null {
  const command = exactRecord(value, ["groupId", "ids", "title", "content"], ["renewAt"]);
  if (!command || !isId(command.groupId) || typeof command.title !== "string" || typeof command.content !== "string" || (command.renewAt !== undefined && typeof command.renewAt !== "string")) return null;
  const ids = denseArray(command.ids); if (!ids || !ids.every(isId)) return null;
  return { ...command, ids: [...ids] as string[] } as GymFixedDemoCreateGroupCommand;
}
function validContent(title: string, content: string): { title: string; content: string } | null { const trimmedTitle = title.trim(); const trimmedContent = content.trim(); return !trimmedTitle || !trimmedContent ? null : { title: trimmedTitle, content: trimmedContent }; }
function parseCommandRenewAt(value: string): string | null { const parsed = new Date(`${value.trim()}T00:00:00.000Z`); return Number.isNaN(parsed.getTime()) ? null : dateKey(parsed); }
function resolveRenewAt(value: string | undefined, assignedAt: Date): string | null { return value === undefined || !value.trim() ? defaultRenewAt(assignedAt) : parseCommandRenewAt(value); }
function resolveOptionalRenewAt(value: string | undefined): string | undefined | null { return value === undefined || !value.trim() ? undefined : parseCommandRenewAt(value); }
function trustedNow(value: unknown): Date | null { if (typeof value !== "function") return null; try { const now = value(); if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null; const copy = new Date(now.getTime()); return copy.toISOString() ? copy : null; } catch { return null; } }
function activeGymRoutine(state: GymFixedDemoState, routineId: string): GymFixedDemoRoutine | null { return state.fixedRoutines.find((candidate) => candidate.id === routineId && candidate.gymId === GYM_FIXED_DEMO_GYM_ID && candidate.deletedAt === null) ?? null; }
function ownershipError(actor: CanonicalActor, routine: GymFixedDemoRoutine): string | null { return actor.role === "TEACHER" && routine.teacherId !== actor.id ? "No autorizado." : null; }

/** Current dated training state is mandatory; caller arrays and snapshots are never trusted. */
export function getGymFixedDemoGroupEligibility(trainingState: unknown, actorInput: unknown, groupInput: unknown): GroupEligibility {
  const resolved = resolveGymFixedGroupAssignment(trainingState, actorInput, groupInput);
  return resolved.success ? { success: true, studentIds: [...resolved.eligibleStudentIds] } : { success: false, error: resolved.error };
}

/**
 * Shared non-mutating group preflight for adapters. It deliberately validates
 * current group scope before title/content, but never reads eligibility, IDs,
 * or clocks. The subsequent mutation independently resolves eligibility from
 * the same captured training state.
 */
export function preflightGymFixedRoutineGroup(trainingState: unknown, actorInput: unknown, groupInput: unknown, title: string, content: string): { success: true } | { success: false; error: string } {
  const scope = resolveGymFixedGroupScope(trainingState, actorInput, groupInput);
  if (!scope.success) return { success: false, error: scope.error };
  const fields = validContent(title, content);
  return fields ? { success: true } : { success: false, error: !title.trim() ? "El título es obligatorio." : "El contenido es obligatorio." };
}

export function createGymFixedRoutine(state: GymFixedDemoState, actorInput: unknown, rawCommand: unknown, now: unknown): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput);
  if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveCreate(rawCommand); if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const student = activeStudent(command.studentId);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (student.accountKind === "LITE") return failure(state, "No se puede asignar rutina fija a un alumno lite.");
  if (actor.role === "TEACHER" && !linked(actor.id, student.id)) return failure(state, "Alumno no asignado a vos.");
  const fields = validContent(command.title, command.content); if (!fields) return failure(state, !command.title.trim() ? "El título es obligatorio." : "El contenido es obligatorio.");
  if (state.fixedRoutines.some((routine) => routine.id === command.id)) return failure(state, "Identificador de rutina inválido.");
  const assigned = trustedNow(now); if (!assigned) return failure(state, "La hora de confianza no es válida.");
  const renewAt = resolveRenewAt(command.renewAt, assigned); if (!renewAt) return failure(state, "Fecha de renovación inválida.");
  const routine: GymFixedDemoRoutine = { id: command.id, gymId: GYM_FIXED_DEMO_GYM_ID, studentId: student.id, teacherId: actor.id, title: fields.title, content: fields.content, assignedAt: assigned.toISOString(), renewAt, deletedAt: null };
  return success({ ...state, fixedRoutines: [...state.fixedRoutines, routine] }, routine.id);
}
export function updateGymFixedRoutine(state: GymFixedDemoState, actorInput: unknown, rawCommand: unknown): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput); if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveUpdate(rawCommand); if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const routine = activeGymRoutine(state, command.routineId); if (!routine) return failure(state, "Rutina no encontrada.");
  const denied = ownershipError(actor, routine); if (denied) return failure(state, denied);
  const fields = validContent(command.title, command.content); if (!fields) return failure(state, !command.title.trim() ? "El título es obligatorio." : "El contenido es obligatorio.");
  const parsedRenewAt = resolveOptionalRenewAt(command.renewAt); if (parsedRenewAt === null) return failure(state, "Fecha de renovación inválida.");
  return success({ ...state, fixedRoutines: state.fixedRoutines.map((candidate) => candidate.id === routine.id ? { ...candidate, ...fields, renewAt: parsedRenewAt ?? routine.renewAt } : candidate) });
}
export function renewGymFixedRoutine(state: GymFixedDemoState, actorInput: unknown, rawCommand: unknown): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput); if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveRenew(rawCommand); if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const routine = activeGymRoutine(state, command.routineId); if (!routine) return failure(state, "Rutina no encontrada.");
  const denied = ownershipError(actor, routine); if (denied) return failure(state, denied);
  const renewAt = parseCommandRenewAt(command.renewAt); if (!renewAt) return failure(state, "Fecha de renovación inválida.");
  return success({ ...state, fixedRoutines: state.fixedRoutines.map((candidate) => candidate.id === routine.id ? { ...candidate, renewAt } : candidate) });
}
export function deleteGymFixedRoutine(state: GymFixedDemoState, actorInput: unknown, rawCommand: unknown, now: unknown): GymFixedDemoTransition<GymFixedDemoResult> {
  const actor = canonicalActor(actorInput); if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveDelete(rawCommand); if (!command) return failure(state, "La rutina no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const routine = activeGymRoutine(state, command.routineId); if (!routine) return failure(state, "Rutina no encontrada.");
  const denied = ownershipError(actor, routine); if (denied) return failure(state, denied);
  const deleted = trustedNow(now); if (!deleted) return failure(state, "La hora de confianza no es válida.");
  return success({ ...state, fixedRoutines: state.fixedRoutines.map((candidate) => candidate.id === routine.id ? { ...candidate, deletedAt: deleted.toISOString() } : candidate) });
}

/** Fixed action order: current group scope, title/content, then current eligibility and atomic IDs. */
export function createGymFixedRoutineForGroup(state: GymFixedDemoState, trainingState: unknown, actorInput: unknown, rawCommand: unknown, now: unknown): GymFixedDemoTransition<GymFixedDemoGroupResult> {
  const actor = canonicalActor(actorInput); if (!actor || !staff(actor)) return failure(state, "No autorizado.");
  const command = resolveGroupCreate(rawCommand); if (!command) return failure(state, "La rutina de grupo no es válida.");
  if (!isValidGymFixedDemoState(state)) return failure(state, "El estado de rutinas no es válido.");
  const preflight = preflightGymFixedRoutineGroup(trainingState, actorInput, command.groupId, command.title, command.content); if (!preflight.success) return failure(state, preflight.error);
  const fields = validContent(command.title, command.content)!;
  const eligibility = resolveGymFixedGroupAssignment(trainingState, actorInput, command.groupId); if (!eligibility.success) return failure(state, eligibility.error);
  if (command.ids.length !== eligibility.eligibleStudentIds.length || new Set(command.ids).size !== command.ids.length || command.ids.some((id) => state.fixedRoutines.some((routine) => routine.id === id))) return failure(state, "Identificadores de rutina inválidos.");
  const assigned = trustedNow(now); if (!assigned) return failure(state, "La hora de confianza no es válida.");
  const renewAt = resolveRenewAt(command.renewAt, assigned); if (!renewAt) return failure(state, "Fecha de renovación inválida.");
  const created = eligibility.eligibleStudentIds.map((studentId, index): GymFixedDemoRoutine => ({ id: command.ids[index]!, gymId: GYM_FIXED_DEMO_GYM_ID, studentId, teacherId: actor.id, title: fields.title, content: fields.content, assignedAt: assigned.toISOString(), renewAt, deletedAt: null }));
  return { state: { ...state, fixedRoutines: [...state.fixedRoutines, ...created] }, result: { success: true, count: created.length } };
}
function compareActive(left: GymFixedDemoRoutine, right: GymFixedDemoRoutine): number { return left.assignedAt !== right.assignedAt ? (left.assignedAt > right.assignedAt ? -1 : 1) : left.id.localeCompare(right.id); }
function activeRoutineForStudent(state: GymFixedDemoState, studentId: string): GymFixedDemoRoutine | null { return state.fixedRoutines.filter((routine) => routine.studentId === studentId && routine.deletedAt === null).sort(compareActive)[0] ?? null; }
export function projectGymFixedStudentRoutine(state: GymFixedDemoState, actorInput: unknown): GymFixedDemoStudentRoutineDto | null {
  const actor = canonicalActor(actorInput); if (!actor || actor.role !== "STUDENT" || actor.studentType !== "MUSCULACION_LIBRE" || actor.accountKind !== "FULL" || !isValidGymFixedDemoState(state)) return null;
  const routine = activeRoutineForStudent(state, actor.id); if (!routine) return null;
  return { id: routine.id, title: routine.title, content: routine.content, assignedAt: new Date(routine.assignedAt), renewAt: dateFromKey(routine.renewAt), teacherName: profile(routine.teacherId)?.name ?? null };
}
/**
 * Current groups come only from the supplied dated ledger; canonical roster remains directory-owned.
 * `nameOverrides` (student id -> current editable name from the profile bridge) is display-only: the
 * MUSCULACION_LIBRE eligibility filter below still reads the frozen canonical `studentType`. Omitted,
 * this is byte-identical to the previous canonical-only projection.
 */
export function projectGymFixedAssignmentContext(state: GymFixedDemoState, trainingState: unknown, actorInput: unknown, nameOverrides?: ReadonlyMap<string, string>): GymFixedDemoAssignmentContext | null {
  const actor = canonicalActor(actorInput); if (!actor || !staff(actor) || !isValidGymFixedDemoState(state)) return null;
  const training = projectGymTrainingViews(trainingState, actorInput); if (!training.success) return null;
  const muslibStudents = getGymDemoProfiles().filter((student) => student.gymId === GYM_FIXED_DEMO_GYM_ID && student.role === "STUDENT" && student.deletedAt === null && student.studentType === "MUSCULACION_LIBRE" && (actor.role === "ADMIN" || linked(actor.id, student.id))).map((student) => ({ id: student.id, name: nameOverrides?.get(student.id) ?? student.name, accountKind: student.accountKind })).sort((left, right) => left.name.localeCompare(right.name));
  return { muslibStudents, groups: training.staff.groups.map((group) => ({ id: group.id, name: group.name })) };
}
/** `nameOverrides` (student id -> current editable name) is display-only; omitted, output is unchanged. */
export function projectGymFixedRenewals(state: GymFixedDemoState, actorInput: unknown, today: unknown, nameOverrides?: ReadonlyMap<string, string>): GymFixedDemoRenewalDto[] | null {
  const actor = canonicalActor(actorInput); if (!actor || !staff(actor) || !isGymFixedDemoDate(today) || !isValidGymFixedDemoState(state)) return null;
  const sevenDaysOut = dateKey(new Date(dateFromKey(today).getTime() + 7 * DAY_MS));
  const sourceOrder = state.fixedRoutines.map((routine, index) => ({ routine, index })).filter(({ routine }) => routine.deletedAt === null && routine.renewAt <= sevenDaysOut && (actor.role !== "TEACHER" || routine.teacherId === actor.id)).sort((left, right) => left.routine.renewAt === right.routine.renewAt ? left.index - right.index : left.routine.renewAt.localeCompare(right.routine.renewAt));
  const byStudent = new Map<string, GymFixedDemoRoutine>();
  for (const { routine } of sourceOrder) { const existing = byStudent.get(routine.studentId); if (!existing || routine.renewAt > existing.renewAt) byStudent.set(routine.studentId, routine); }
  return [...byStudent.values()].map((routine) => ({ id: routine.id, studentId: routine.studentId, studentName: nameOverrides?.get(routine.studentId) ?? (profile(routine.studentId)?.name ?? ""), renewAt: dateFromKey(routine.renewAt), overdue: routine.renewAt < today }));
}
export function resetGymFixedDemoState(): GymFixedDemoState { return createGymFixedDemoFixture(); }
