// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getGymAccessDemoMemberNumber, getGymAccessDemoStudentIds } from "./gym-access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_ACCESS_DEMO_NAMESPACE, GYM_ACCESS_DEMO_VERSION } from "./gym-access-demo-types.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_DEMO_ADMIN_ID, resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type {
  GymAccessCommandResult,
  GymAccessDailyFeed,
  GymAccessDecision,
  GymAccessDecisionResult,
  GymAccessDemoLog,
  GymAccessDemoState,
  GymAccessHistoryRow,
  GymAccessLookupResult,
  GymAccessProfileOverride,
  GymAccessStudent,
  GymAccessUserDto,
} from "./gym-access-demo-types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function id(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

/** Same enumeration as gym-demo-profile-core.ts's ownKeys: a non-enumerable own key still counts. */
function ownKeys(value: Record<string, unknown>): string[] {
  return Reflect.ownKeys(value).filter((key): key is string => typeof key === "string");
}

function exactly(keys: readonly string[], expected: readonly string[]): boolean {
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

/** Calendar validation avoids Date.UTC's 1900 offset for years 0000–0099. This module never imports BOX's access-demo-state.ts. */
export function isGymAccessDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function isGymAccessInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

/**
 * Block status wins, then exemption, then the current due-date comparison — byte-identical rule
 * to BOX's isAccessAlDia, duplicated here (not imported) so this module never depends on any BOX
 * access file. `subject.blocked` and `subject.paymentExempt` are expected to already carry the
 * profile bridge's current values, applied by applyGymAccessProfileOverrides below.
 */
export function isGymAccessAlDia(subject: Pick<GymAccessStudent, "nextPaymentDate" | "paymentExempt" | "blocked">, today: string): boolean {
  if (!isGymAccessDate(today) || !isGymAccessDate(subject.nextPaymentDate)) return false;
  if (subject.blocked) return false;
  if (subject.paymentExempt) return true;
  return subject.nextPaymentDate >= today;
}

/**
 * The connection this unit exists for: `blocked`/`paymentExempt` are governed by the profile
 * bridge, not by GYM finance. A student absent from `overrides` (never edited through the bridge)
 * keeps exactly its finance-derived value — the overlay changes nothing for that row.
 */
export function applyGymAccessProfileOverrides(
  students: readonly GymAccessStudent[],
  overrides: ReadonlyMap<string, GymAccessProfileOverride> | undefined,
): GymAccessStudent[] {
  return students.map((student) => {
    const override = overrides?.get(student.id);
    return {
      ...student,
      assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })),
      blocked: override ? override.blocked : student.blocked,
      paymentExempt: override ? override.paymentExempt : student.paymentExempt,
    };
  });
}

/** Member numbers stay canonical (the directory's own token), never recomputed from array order. */
function memberNumber(studentId: string): number | null {
  return getGymAccessDemoMemberNumber(studentId);
}

/** Only the single canonical GYM ADMIN identity is an access operator; no fourth identity is invented. */
export function isAuthorizedGymAccessActor(token: unknown): boolean {
  const actor = resolveGymDemoActor(token);
  return actor !== null && actor.role === "ADMIN";
}

function detachedStudent(student: GymAccessStudent): GymAccessUserDto | null {
  const number = memberNumber(student.id);
  if (number === null || student.deletedAt) return null;
  return {
    id: student.id,
    name: student.name,
    role: "STUDENT",
    memberNumber: number,
    nextPaymentDate: student.nextPaymentDate,
    blockedAt: student.blocked ? `${student.nextPaymentDate}T00:00:00.000Z` : null,
  };
}

function historicalStudent(student: GymAccessStudent | undefined): GymAccessUserDto | null {
  if (!student) return null;
  const number = memberNumber(student.id);
  if (number === null) return null;
  return {
    id: student.id,
    name: student.name,
    role: "STUDENT",
    memberNumber: number,
    nextPaymentDate: student.nextPaymentDate,
    blockedAt: student.blocked ? `${student.nextPaymentDate}T00:00:00.000Z` : null,
  };
}

export function lookupGymAccessStudent(input: unknown, students: readonly GymAccessStudent[], today: string): GymAccessLookupResult {
  if (typeof input !== "string") return { success: false, error: "Ingresá un identificador." };
  const trimmed = input.trim();
  if (!trimmed) return { success: false, error: "Ingresá un identificador." };
  let student: GymAccessStudent | undefined;
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    student = students.find((candidate) => !candidate.deletedAt && candidate.email === email);
  } else if (/^\d{1,6}$/.test(trimmed)) {
    const number = Number.parseInt(trimmed, 10);
    student = students.find((candidate) => !candidate.deletedAt && memberNumber(candidate.id) === number);
  }
  const user = student ? detachedStudent(student) : null;
  if (!student || !user) return { success: false, error: "No se encontró ningún socio con ese identificador." };
  return { success: true, user: { ...user }, alDia: isGymAccessAlDia(student, today) };
}

function validLog(value: unknown, knownStudents: ReadonlySet<string>, ids: Set<string>): value is GymAccessDemoLog {
  if (!isPlainRecord(value) || !exactly(ownKeys(value), ["id", "userId", "at", "state", "decidedById", "decidedAt"])) return false;
  if (!id(value.id) || !id(value.userId) || !knownStudents.has(value.userId) || ids.has(value.id) || !isGymAccessInstant(value.at)) return false;
  if (value.state !== "PENDING" && value.state !== "GRANTED" && value.state !== "DENIED") return false;
  const nullDecision = value.decidedById === null && value.decidedAt === null;
  const completeDecision = id(value.decidedById) && isGymAccessInstant(value.decidedAt) && (value.decidedAt as string) >= (value.at as string);
  if (value.state === "PENDING" ? !nullDecision : !(nullDecision || completeDecision)) return false;
  if (value.state === "DENIED" && !completeDecision) return false;
  if (completeDecision && value.decidedById !== GYM_DEMO_ADMIN_ID) return false;
  ids.add(value.id);
  return true;
}

/** Closed persisted schema: arrays, nested rows, and decisions are all validated against the GYM roster only. */
export function isValidGymAccessDemoState(value: unknown): value is GymAccessDemoState {
  if (!isPlainRecord(value) || !exactly(ownKeys(value), ["version", "namespace", "logs"])) return false;
  if (value.version !== GYM_ACCESS_DEMO_VERSION || value.namespace !== GYM_ACCESS_DEMO_NAMESPACE || !Array.isArray(value.logs)) return false;
  const knownStudents = new Set(getGymAccessDemoStudentIds());
  const ids = new Set<string>();
  return value.logs.every((log) => validLog(log, knownStudents, ids));
}

function failure(state: GymAccessDemoState, error: string): { state: GymAccessDemoState; result: GymAccessCommandResult | GymAccessDecisionResult } {
  return { state, result: { success: false, error } };
}

function validDecision(value: unknown): value is GymAccessDecision {
  return value === "GRANT" || value === "DENY";
}

function decisionState(decision: GymAccessDecision): "GRANTED" | "DENIED" {
  return decision === "GRANT" ? "GRANTED" : "DENIED";
}

export function createManualGymAccess(
  state: GymAccessDemoState,
  actorToken: unknown,
  students: readonly GymAccessStudent[],
  userId: unknown,
  decision: unknown,
  at: unknown,
  nextId: () => string,
): { state: GymAccessDemoState; result: GymAccessCommandResult } {
  if (!isAuthorizedGymAccessActor(actorToken)) return failure(state, "No autorizado.") as { state: GymAccessDemoState; result: GymAccessCommandResult };
  if (!isValidGymAccessDemoState(state)) return failure(state, "El estado de accesos no es válido.") as { state: GymAccessDemoState; result: GymAccessCommandResult };
  if (!validDecision(decision)) return failure(state, "La decisión no es válida.") as { state: GymAccessDemoState; result: GymAccessCommandResult };
  if (!id(userId)) return failure(state, "Alumno no encontrado.") as { state: GymAccessDemoState; result: GymAccessCommandResult };
  const student = students.find((candidate) => candidate.id === userId && !candidate.deletedAt);
  if (!student) return failure(state, "Alumno no encontrado.") as { state: GymAccessDemoState; result: GymAccessCommandResult };
  if (!isGymAccessInstant(at)) return failure(state, "La hora de confianza no es válida.") as { state: GymAccessDemoState; result: GymAccessCommandResult };
  const logId = nextId();
  if (!id(logId) || state.logs.some((log) => log.id === logId)) return failure(state, "No se pudo asignar un identificador de ingreso.") as { state: GymAccessDemoState; result: GymAccessCommandResult };
  const resolved = decisionState(decision);
  const log: GymAccessDemoLog = { id: logId, userId: student.id, at, state: resolved, decidedById: GYM_DEMO_ADMIN_ID, decidedAt: at };
  return { state: { ...state, logs: [...state.logs, log] }, result: { success: true, logId, state: resolved } };
}

export function decidePendingGymAccess(
  state: GymAccessDemoState,
  actorToken: unknown,
  logId: unknown,
  decision: unknown,
  decidedAt: unknown,
): { state: GymAccessDemoState; result: GymAccessDecisionResult } {
  if (!isAuthorizedGymAccessActor(actorToken)) return failure(state, "No autorizado.") as { state: GymAccessDemoState; result: GymAccessDecisionResult };
  if (!isValidGymAccessDemoState(state)) return failure(state, "El estado de accesos no es válido.") as { state: GymAccessDemoState; result: GymAccessDecisionResult };
  if (!validDecision(decision)) return failure(state, "La decisión no es válida.") as { state: GymAccessDemoState; result: GymAccessDecisionResult };
  if (!id(logId)) return failure(state, "Ingreso no encontrado.") as { state: GymAccessDemoState; result: GymAccessDecisionResult };
  const log = state.logs.find((candidate) => candidate.id === logId);
  if (!log) return failure(state, "Ingreso no encontrado.") as { state: GymAccessDemoState; result: GymAccessDecisionResult };
  if (log.state !== "PENDING") return failure(state, "Este ingreso ya fue resuelto.") as { state: GymAccessDemoState; result: GymAccessDecisionResult };
  if (!isGymAccessInstant(decidedAt) || decidedAt < log.at) return failure(state, "La hora de confianza no es válida.") as { state: GymAccessDemoState; result: GymAccessDecisionResult };
  const resolved = decisionState(decision);
  return {
    state: { ...state, logs: state.logs.map((candidate) => candidate.id === log.id ? { ...candidate, state: resolved, decidedById: GYM_DEMO_ADMIN_ID, decidedAt } : candidate) },
    result: { success: true, logId: log.id, state: resolved },
  };
}

function compareNewest(left: GymAccessDemoLog, right: GymAccessDemoLog): number {
  if (left.at !== right.at) return left.at > right.at ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function toHistory(log: GymAccessDemoLog, students: readonly GymAccessStudent[], operatorName: string | null): GymAccessHistoryRow {
  const user = historicalStudent(students.find((student) => student.id === log.userId));
  return { ...log, user: user ? { ...user } : null, decidedByName: log.decidedById === GYM_DEMO_ADMIN_ID ? operatorName : null };
}

/** Projections authorize before inspecting ledger or roster and never return mutable profile references. */
export function projectGymAccessHistory(
  state: GymAccessDemoState,
  actorToken: unknown,
  students: readonly GymAccessStudent[],
  operatorName: string | null,
): GymAccessHistoryRow[] | null {
  if (!isAuthorizedGymAccessActor(actorToken)) return null;
  if (!isValidGymAccessDemoState(state)) return null;
  return state.logs.slice().sort(compareNewest).slice(0, 200).map((log) => toHistory(log, students, operatorName));
}

export function projectGymAccessDailyFeed(
  state: GymAccessDemoState,
  actorToken: unknown,
  students: readonly GymAccessStudent[],
  operatorName: string | null,
  today: string,
  now: string,
): GymAccessDailyFeed | null {
  if (!isAuthorizedGymAccessActor(actorToken)) return null;
  if (!isValidGymAccessDemoState(state) || !isGymAccessDate(today) || !isGymAccessInstant(now)) return null;
  const dayStart = `${today}T03:00:00.000Z`;
  const next = new Date(`${today}T03:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = next.toISOString();
  const fiveMinutesAgo = new Date(now).getTime() - 5 * 60 * 1000;
  const pending = state.logs.filter((log) => log.state === "PENDING" && new Date(log.at).getTime() >= fiveMinutesAgo).sort((a, b) => a.at === b.at ? (a.id < b.id ? -1 : 1) : (a.at < b.at ? -1 : 1));
  const recent = state.logs.filter((log) => (log.state === "GRANTED" || log.state === "DENIED") && log.at >= dayStart && log.at < dayEnd).sort(compareNewest);
  return { pending: pending.map((log) => toHistory(log, students, operatorName)), recent: recent.map((log) => toHistory(log, students, operatorName)), date: today };
}
