// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { financeCatalogSaleActors } from "../finance/catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getAccessDemoOperatorName, getAccessDemoStudentIds, getAccessDemoStudents } from "./access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { ACCESS_DEMO_NAMESPACE, ACCESS_DEMO_VERSION } from "./access-demo-types.ts";
import type {
  AccessCommandResult,
  AccessDecision,
  AccessDecisionResult,
  AccessDemoLog,
  AccessDemoState,
  AccessDailyFeed,
  AccessHistoryRow,
  AccessLookupResult,
  AccessPaymentSubject,
  AccessStudent,
  AccessUserDto,
} from "./access-demo-types";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const accessActors = [financeCatalogSaleActors.admin, financeCatalogSaleActors.unprivilegedAdmin] as const;

function safe<T>(callback: () => T): T | null {
  try { return callback(); } catch { return null; }
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  return safe(() => {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || !own.every((key) => typeof key === "string" && keys.includes(key)) || !keys.every((key) => own.includes(key))) return null;
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    }
    return Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
  });
}

function denseArray(value: unknown): unknown[] | null {
  return safe(() => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const own = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 || lengthDescriptor.enumerable) return null;
    const length = lengthDescriptor.value;
    if (own.length !== length + 1 || !own.every((key) => key === "length" || (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length))) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
      result.push(descriptor.value);
    }
    return result;
  });
}

function id(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Calendar validation avoids Date.UTC's 1900 offset for years 0000–0099. */
export function isAccessDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function isAccessInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function memberNumber(studentId: string): number | null {
  const active = getAccessDemoStudents().filter((student) => !student.deletedAt);
  const index = active.findIndex((student) => student.id === studentId);
  return index < 0 ? null : index + 1;
}

function canonicalActor(value: unknown): (typeof accessActors)[number] | null {
  return accessActors.find((actor) => actor === value) ?? null;
}

/** Only the two frozen ADMIN identities are access operators; permissions are not capability claims. */
export function isAuthorizedAccessActor(value: unknown): boolean {
  return canonicalActor(value) !== null;
}

function detachedStudent(student: AccessStudent): AccessUserDto | null {
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

function historicalStudent(student: AccessStudent | undefined): AccessUserDto | null {
  if (!student) return null;
  const number = getAccessDemoStudents().findIndex((candidate) => candidate.id === student.id);
  if (number < 0) return null;
  return {
    id: student.id,
    name: student.name,
    role: "STUDENT",
    memberNumber: number + 1,
    nextPaymentDate: student.nextPaymentDate,
    blockedAt: student.blocked ? `${student.nextPaymentDate}T00:00:00.000Z` : null,
  };
}

/** Block status wins, then exemption, then the current due-date comparison. */
export function isAccessAlDia(subject: AccessPaymentSubject, today: string): boolean {
  if (!isAccessDate(today) || !isAccessDate(subject.nextPaymentDate)) return false;
  if (subject.blocked) return false;
  if (subject.paymentExempt) return true;
  if (subject.role && subject.role !== "STUDENT") return true;
  return subject.nextPaymentDate >= today;
}

export function lookupAccessStudent(input: unknown, students: readonly AccessStudent[], today: string): AccessLookupResult {
  if (typeof input !== "string") return { success: false, error: "Ingresá un identificador." };
  const trimmed = input.trim();
  if (!trimmed) return { success: false, error: "Ingresá un identificador." };
  let student: AccessStudent | undefined;
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    student = students.find((candidate) => !candidate.deletedAt && candidate.email === email);
  } else if (/^\d{1,6}$/.test(trimmed)) {
    const number = Number.parseInt(trimmed, 10);
    student = students.find((candidate) => !candidate.deletedAt && memberNumber(candidate.id) === number);
  }
  const user = student ? detachedStudent(student) : null;
  if (!student || !user) return { success: false, error: "No se encontró ningún socio con ese identificador." };
  return { success: true, user: { ...user }, alDia: isAccessAlDia(student, today) };
}

function validLog(value: unknown, knownStudents: ReadonlySet<string>, ids: Set<string>): value is AccessDemoLog {
  const record = exactRecord(value, ["id", "userId", "at", "state", "decidedById", "decidedAt"]);
  if (!record || !id(record.id) || !id(record.userId) || !knownStudents.has(record.userId) || ids.has(record.id) || !isAccessInstant(record.at)) return false;
  if (record.state !== "PENDING" && record.state !== "GRANTED" && record.state !== "DENIED") return false;
  const nullDecision = record.decidedById === null && record.decidedAt === null;
  const completeDecision = id(record.decidedById) && isAccessInstant(record.decidedAt) && record.decidedAt >= record.at;
  if (record.state === "PENDING" ? !nullDecision : !(nullDecision || completeDecision)) return false;
  if (record.state === "DENIED" && !completeDecision) return false;
  if (completeDecision && !accessActors.some((actor) => actor.id === record.decidedById)) return false;
  ids.add(record.id);
  return true;
}

/** Closed persisted schema: arrays, nested rows, known relations, and decisions are all validated. */
export function isValidAccessDemoState(value: unknown): value is AccessDemoState {
  const record = exactRecord(value, ["version", "namespace", "logs"]);
  if (!record || record.version !== ACCESS_DEMO_VERSION || record.namespace !== ACCESS_DEMO_NAMESPACE) return false;
  const logs = denseArray(record.logs);
  if (!logs) return false;
  const knownStudents = new Set(getAccessDemoStudentIds());
  const ids = new Set<string>();
  return logs.every((log) => validLog(log, knownStudents, ids));
}

function failure(state: AccessDemoState, error: string): { state: AccessDemoState; result: AccessCommandResult | AccessDecisionResult } {
  return { state, result: { success: false, error } };
}

function validDecision(value: unknown): value is AccessDecision {
  return value === "GRANT" || value === "DENY";
}

function decisionState(decision: AccessDecision): "GRANTED" | "DENIED" {
  return decision === "GRANT" ? "GRANTED" : "DENIED";
}

export function createManualAccess(
  state: AccessDemoState,
  actorInput: unknown,
  students: readonly AccessStudent[],
  userId: unknown,
  decision: unknown,
  at: unknown,
  nextId: () => string,
): { state: AccessDemoState; result: AccessCommandResult } {
  const actor = canonicalActor(actorInput);
  if (!actor) return failure(state, "No autorizado.") as { state: AccessDemoState; result: AccessCommandResult };
  if (!isValidAccessDemoState(state)) return failure(state, "El estado de accesos no es válido.") as { state: AccessDemoState; result: AccessCommandResult };
  if (!validDecision(decision)) return failure(state, "La decisión no es válida.") as { state: AccessDemoState; result: AccessCommandResult };
  if (!id(userId)) return failure(state, "Alumno no encontrado.") as { state: AccessDemoState; result: AccessCommandResult };
  const student = students.find((candidate) => candidate.id === userId && !candidate.deletedAt);
  if (!student) return failure(state, "Alumno no encontrado.") as { state: AccessDemoState; result: AccessCommandResult };
  if (!isAccessInstant(at)) return failure(state, "La hora de confianza no es válida.") as { state: AccessDemoState; result: AccessCommandResult };
  const logId = nextId();
  if (!id(logId) || state.logs.some((log) => log.id === logId)) return failure(state, "No se pudo asignar un identificador de ingreso.") as { state: AccessDemoState; result: AccessCommandResult };
  const resolved = decisionState(decision);
  const log: AccessDemoLog = { id: logId, userId: student.id, at, state: resolved, decidedById: actor.id, decidedAt: at };
  return { state: { ...state, logs: [...state.logs, log] }, result: { success: true, logId, state: resolved } };
}

export function decidePendingAccess(
  state: AccessDemoState,
  actorInput: unknown,
  logId: unknown,
  decision: unknown,
  decidedAt: unknown,
): { state: AccessDemoState; result: AccessDecisionResult } {
  const actor = canonicalActor(actorInput);
  if (!actor) return failure(state, "No autorizado.") as { state: AccessDemoState; result: AccessDecisionResult };
  if (!isValidAccessDemoState(state)) return failure(state, "El estado de accesos no es válido.") as { state: AccessDemoState; result: AccessDecisionResult };
  if (!validDecision(decision)) return failure(state, "La decisión no es válida.") as { state: AccessDemoState; result: AccessDecisionResult };
  if (!id(logId)) return failure(state, "Ingreso no encontrado.") as { state: AccessDemoState; result: AccessDecisionResult };
  const log = state.logs.find((candidate) => candidate.id === logId);
  if (!log) return failure(state, "Ingreso no encontrado.") as { state: AccessDemoState; result: AccessDecisionResult };
  if (log.state !== "PENDING") return failure(state, "Este ingreso ya fue resuelto.") as { state: AccessDemoState; result: AccessDecisionResult };
  if (!isAccessInstant(decidedAt) || decidedAt < log.at) return failure(state, "La hora de confianza no es válida.") as { state: AccessDemoState; result: AccessDecisionResult };
  const resolved = decisionState(decision);
  return {
    state: { ...state, logs: state.logs.map((candidate) => candidate.id === log.id ? { ...candidate, state: resolved, decidedById: actor.id, decidedAt } : candidate) },
    result: { success: true, logId: log.id, state: resolved },
  };
}

function authorizeProjection(actor: unknown): boolean {
  return canonicalActor(actor) !== null;
}

function compareNewest(left: AccessDemoLog, right: AccessDemoLog): number {
  if (left.at !== right.at) return left.at > right.at ? -1 : 1;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function toHistory(log: AccessDemoLog, students: readonly AccessStudent[]): AccessHistoryRow {
  const user = historicalStudent(students.find((student) => student.id === log.userId));
  const actor = log.decidedById ? accessActors.find((candidate) => candidate.id === log.decidedById) : null;
  return { ...log, user: user ? { ...user } : null, decidedByName: actor ? getAccessDemoOperatorName(actor.id) : null };
}

/** Projections authorize before inspecting ledger or roster and never return mutable profile references. */
export function projectAccessHistory(state: AccessDemoState, actor: unknown, students: readonly AccessStudent[]): AccessHistoryRow[] | null {
  if (!authorizeProjection(actor)) return null;
  if (!isValidAccessDemoState(state)) return null;
  return state.logs.slice().sort(compareNewest).slice(0, 200).map((log) => toHistory(log, students));
}

export function projectAccessDailyFeed(
  state: AccessDemoState,
  actor: unknown,
  students: readonly AccessStudent[],
  today: string,
  now: string,
): AccessDailyFeed | null {
  if (!authorizeProjection(actor)) return null;
  if (!isValidAccessDemoState(state) || !isAccessDate(today) || !isAccessInstant(now)) return null;
  const dayStart = `${today}T03:00:00.000Z`;
  const next = new Date(`${today}T03:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = next.toISOString();
  const fiveMinutesAgo = new Date(now).getTime() - 5 * 60 * 1000;
  const pending = state.logs.filter((log) => log.state === "PENDING" && new Date(log.at).getTime() >= fiveMinutesAgo).sort((a, b) => a.at === b.at ? (a.id < b.id ? -1 : 1) : (a.at < b.at ? -1 : 1));
  const recent = state.logs.filter((log) => (log.state === "GRANTED" || log.state === "DENIED") && log.at >= dayStart && log.at < dayEnd).sort(compareNewest);
  return { pending: pending.map((log) => toHistory(log, students)), recent: recent.map((log) => toHistory(log, students)), date: today };
}
