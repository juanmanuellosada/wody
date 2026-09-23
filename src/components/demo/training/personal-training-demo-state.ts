// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createPersonalTrainingDemoFixture } from "./personal-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { PERSONAL_TRAINING_DEMO_NAMESPACE, PERSONAL_TRAINING_DEMO_VERSION } from "./personal-training-demo-types.ts";
import type {
  PersonalTrainingActorToken,
  PersonalTrainingCopyResult,
  PersonalTrainingCopyToDatesCommand,
  PersonalTrainingCreateWodCommand,
  PersonalTrainingDeleteWodCommand,
  PersonalTrainingDemoState,
  PersonalTrainingTransition,
  PersonalTrainingUpdateWodCommand,
  PersonalTrainingWod,
  PersonalTrainingWodResult,
  PersonalTrainingWodViewRow,
} from "./personal-training-demo-types";

const OWNER_ID = "personal-student-owner";
const WOD_ID_PREFIX = "personal-wod-";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const canonicalActor = Object.freeze({});
const actorCapabilities = new WeakMap<object, true>([[canonicalActor, true]]);

function transition<R>(state: PersonalTrainingDemoState, result: R): PersonalTrainingTransition<R> {
  return { state, result };
}

function failure<R extends { success: false; error: string }>(
  state: PersonalTrainingDemoState,
  error: string,
): PersonalTrainingTransition<R> {
  return transition(state, { success: false, error } as R);
}

/** The sole PERSONAL capability is identity-based and cannot be recreated from caller fields. */
export function getPersonalTrainingActorToken(): PersonalTrainingActorToken {
  return canonicalActor as PersonalTrainingActorToken;
}

function isCanonicalActor(actor: unknown): boolean {
  return typeof actor === "object" && actor !== null && actorCapabilities.get(actor) === true;
}

function closedDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const names = Object.getOwnPropertyNames(value);
    if (Object.getOwnPropertySymbols(value).length !== 0 || names.length < requiredKeys.length) return null;
    for (const name of names) {
      if (!allowedKeys.includes(name)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    }
    for (const key of requiredKeys) if (!Object.hasOwn(value, key)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function closedArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length !== 0) return null;
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== value.length + 1 || !names.includes("length")) return null;
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** Mirrors `new Date(date + "T00:00:00.000Z")`, then stores its canonical @db.Date key. */
export function parsePersonalTrainingDate(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isCanonicalDate(value: unknown): value is string {
  return typeof value === "string" && parsePersonalTrainingDate(value) === value;
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== "string" || !INSTANT_PATTERN.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isPersonalWodId(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(WOD_ID_PREFIX) && value.trim() === value && value.length > WOD_ID_PREFIX.length;
}

function isLockedTarget(value: unknown): boolean {
  const target = closedDataRecord(value, ["type", "studentId"], ["type", "studentId"]);
  return target !== null && target.type === "STUDENT" && target.studentId === OWNER_ID;
}

function isValidPersonalWod(value: unknown): value is PersonalTrainingWod {
  const wod = closedDataRecord(
    value,
    ["id", "title", "content", "date", "teacherId", "targetType", "targetGroupId", "targetStudentId", "deletedAt"],
    ["id", "title", "content", "date", "teacherId", "targetType", "targetGroupId", "targetStudentId", "deletedAt"],
  );
  return wod !== null
    && isPersonalWodId(wod.id)
    && typeof wod.title === "string"
    && typeof wod.content === "string"
    && isCanonicalDate(wod.date)
    && wod.teacherId === OWNER_ID
    && wod.targetType === "STUDENT"
    && wod.targetGroupId === null
    && wod.targetStudentId === OWNER_ID
    && (wod.deletedAt === null || isCanonicalInstant(wod.deletedAt));
}

/** A strict ledger rejects foreign namespaces, aliases, sparse data, and any non-own routine. */
export function isValidPersonalTrainingDemoState(value: unknown): value is PersonalTrainingDemoState {
  const state = closedDataRecord(value, ["version", "namespace", "wods"], ["version", "namespace", "wods"]);
  if (state === null || state.version !== PERSONAL_TRAINING_DEMO_VERSION || state.namespace !== PERSONAL_TRAINING_DEMO_NAMESPACE) return false;
  const wods = closedArray(state.wods);
  if (wods === null || !wods.every(isValidPersonalWod)) return false;
  const ids = new Set<string>();
  for (const wod of wods) {
    if (ids.has(wod.id)) return false;
    ids.add(wod.id);
  }
  return true;
}

function canUseLedger(actor: unknown, state: unknown): state is PersonalTrainingDemoState {
  return isCanonicalActor(actor) && isValidPersonalTrainingDemoState(state);
}

function activeOwnWod(state: PersonalTrainingDemoState, wodId: unknown): PersonalTrainingWod | undefined {
  return typeof wodId === "string"
    ? state.wods.find((wod) => wod.id === wodId && wod.deletedAt === null && wod.teacherId === OWNER_ID && wod.targetStudentId === OWNER_ID)
    : undefined;
}

function titleAndContent(title: unknown, content: unknown): { title: string; content: string } | null {
  if (typeof title !== "string" || typeof content !== "string" || !content.trim()) return null;
  return { title: title.trim() || "Rutina", content };
}

function uniqueIds(state: PersonalTrainingDemoState, ids: readonly unknown[]): ids is readonly string[] {
  const occupied = new Set(state.wods.map((wod) => wod.id));
  for (const id of ids) {
    if (!isPersonalWodId(id) || occupied.has(id)) return false;
    occupied.add(id);
  }
  return true;
}

function commandDate(value: unknown): string | null {
  return parsePersonalTrainingDate(value);
}

export function createPersonalTrainingWod(
  state: PersonalTrainingDemoState,
  actor: unknown,
  command: PersonalTrainingCreateWodCommand | unknown,
): PersonalTrainingTransition<PersonalTrainingWodResult> {
  if (!isCanonicalActor(actor)) return failure(state, "No autorizado.");
  if (!isValidPersonalTrainingDemoState(state)) return failure(state, "Estado de rutinas inválido.");
  const input = closedDataRecord(command, ["id", "date", "title", "content", "target"], ["id", "date", "title", "content", "target"]);
  if (!input || !isLockedTarget(input.target)) return failure(state, "No autorizado.");
  const fields = titleAndContent(input.title, input.content);
  const date = commandDate(input.date);
  if (!fields) return failure(state, "El contenido de la Rutina no puede estar vacio.");
  if (!date) return failure(state, "La fecha no es válida.");
  if (!uniqueIds(state, [input.id])) return failure(state, "Identificador de rutina inválido.");
  const wodId = input.id as string;
  return transition({
    ...state,
    wods: [...state.wods, {
      id: wodId,
      date,
      title: fields.title,
      content: fields.content,
      teacherId: OWNER_ID,
      targetType: "STUDENT",
      targetGroupId: null,
      targetStudentId: OWNER_ID,
      deletedAt: null,
    }],
  }, { success: true, wodId });
}

export function updatePersonalTrainingWod(
  state: PersonalTrainingDemoState,
  actor: unknown,
  command: PersonalTrainingUpdateWodCommand | unknown,
): PersonalTrainingTransition<PersonalTrainingWodResult> {
  if (!isCanonicalActor(actor)) return failure(state, "No autorizado.");
  if (!isValidPersonalTrainingDemoState(state)) return failure(state, "Estado de rutinas inválido.");
  const input = closedDataRecord(command, ["wodId", "title", "content", "date", "target"], ["wodId", "title", "content"]);
  if (!input) return failure(state, "Rutina no encontrada.");
  const wod = activeOwnWod(state, input.wodId);
  if (!wod) return failure(state, "Rutina no encontrada.");
  if (Object.hasOwn(input, "target") && !isLockedTarget(input.target)) return failure(state, "No autorizado.");
  const fields = titleAndContent(input.title, input.content);
  if (!fields) return failure(state, "El contenido de la Rutina no puede estar vacio.");
  // updateWod only parses a supplied truthy date; empty input preserves its current date.
  const date = Object.hasOwn(input, "date") && input.date ? commandDate(input.date) : wod.date;
  if (!date) return failure(state, "La fecha no es válida.");
  return transition({
    ...state,
    wods: state.wods.map((candidate) => candidate.id === wod.id ? { ...candidate, ...fields, date } : candidate),
  }, { success: true });
}

export function deletePersonalTrainingWod(
  state: PersonalTrainingDemoState,
  actor: unknown,
  command: PersonalTrainingDeleteWodCommand | unknown,
  clock: () => Date,
): PersonalTrainingTransition<PersonalTrainingWodResult> {
  if (!isCanonicalActor(actor)) return failure(state, "No autorizado.");
  if (!isValidPersonalTrainingDemoState(state)) return failure(state, "Estado de rutinas inválido.");
  const input = closedDataRecord(command, ["wodId"], ["wodId"]);
  const wod = input ? activeOwnWod(state, input.wodId) : undefined;
  if (!wod) return failure(state, "Rutina no encontrada.");
  const now = clock();
  if (Object.getPrototypeOf(now) !== Date.prototype || Number.isNaN(now.getTime())) return failure(state, "La fecha de eliminación no es válida.");
  const deletedAt = now.toISOString();
  return transition({
    ...state,
    wods: state.wods.map((candidate) => candidate.id === wod.id ? { ...candidate, deletedAt } : candidate),
  }, { success: true });
}

export function copyPersonalTrainingWodToDates(
  state: PersonalTrainingDemoState,
  actor: unknown,
  command: PersonalTrainingCopyToDatesCommand | unknown,
): PersonalTrainingTransition<PersonalTrainingCopyResult> {
  if (!isCanonicalActor(actor)) return failure(state, "No autorizado.");
  if (!isValidPersonalTrainingDemoState(state)) return failure(state, "Estado de rutinas inválido.");
  const input = closedDataRecord(command, ["sourceWodId", "ids", "targetDates", "target"], ["sourceWodId", "ids", "targetDates"]);
  if (!input) return failure(state, "Rutina origen no encontrada.");
  const source = activeOwnWod(state, input.sourceWodId);
  if (!source) return failure(state, "Rutina origen no encontrada.");
  if (Object.hasOwn(input, "target") && !isLockedTarget(input.target)) return failure(state, "No autorizado.");
  const ids = closedArray(input.ids);
  const targetDates = closedArray(input.targetDates);
  if (!ids || !targetDates || ids.length === 0 || ids.length !== targetDates.length || !uniqueIds(state, ids)) {
    return failure(state, "Identificador de rutina inválido.");
  }
  const dates = targetDates.map(commandDate);
  if (dates.some((date) => date === null)) return failure(state, "La fecha no es válida.");
  const wodIds = [...ids] as string[];
  const normalizedDates = dates as string[];
  const copies: PersonalTrainingWod[] = wodIds.map((id, index) => ({
    id,
    title: source.title,
    content: source.content,
    date: normalizedDates[index],
    teacherId: OWNER_ID,
    targetType: "STUDENT",
    targetGroupId: null,
    targetStudentId: OWNER_ID,
    deletedAt: null,
  }));
  return transition({ ...state, wods: [...state.wods, ...copies] }, { success: true, count: copies.length, wodIds });
}

/** The one-date callback form has the same result shape as production's copyWod action. */
export function copyPersonalTrainingWod(
  state: PersonalTrainingDemoState,
  actor: unknown,
  command: { id: string; sourceWodId: string; targetDate: string; target?: { type: "STUDENT"; studentId: string } } | unknown,
): PersonalTrainingTransition<PersonalTrainingWodResult> {
  if (!isCanonicalActor(actor)) return failure(state, "No autorizado.");
  if (!isValidPersonalTrainingDemoState(state)) return failure(state, "Estado de rutinas inválido.");
  const input = closedDataRecord(command, ["id", "sourceWodId", "targetDate", "target"], ["id", "sourceWodId", "targetDate"]);
  if (!input) return failure(state, "Rutina origen no encontrada.");
  const copied = copyPersonalTrainingWodToDates(state, actor, {
    sourceWodId: input.sourceWodId as string,
    ids: [input.id as string],
    targetDates: [input.targetDate as string],
    ...(Object.hasOwn(input, "target") ? { target: input.target as { type: "STUDENT"; studentId: string } } : {}),
  });
  return copied.result.success
    ? transition(copied.state, { success: true, wodId: copied.result.wodIds[0] })
    : failure(state, copied.result.error);
}

/** Matches the PERSONAL Mis rutinas query: own, active, date DESC, stable equal-date order. */
export function projectPersonalTrainingWods(
  state: PersonalTrainingDemoState,
  actor: unknown,
): PersonalTrainingWodViewRow[] | null {
  if (!canUseLedger(actor, state)) return null;
  return state.wods
    .filter((wod) => wod.deletedAt === null && wod.teacherId === OWNER_ID && wod.targetType === "STUDENT" && wod.targetStudentId === OWNER_ID)
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((wod) => ({
      id: wod.id,
      title: wod.title,
      content: wod.content,
      date: new Date(`${wod.date}T00:00:00.000Z`),
      targetType: "STUDENT",
      targetGroupId: null,
      targetStudentId: OWNER_ID,
      targetGroupName: null,
      targetStudentName: null,
    }));
}

/** Reset is pure and recreates only this isolated PERSONAL fixture. */
export function resetPersonalTrainingDemoState(): PersonalTrainingDemoState {
  return createPersonalTrainingDemoFixture();
}
