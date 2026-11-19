/** Narrow, policy-free mechanics shared by the closed BOX and GYM dated-training kernels. */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function safe<T>(callback: () => T): T | null {
  try {
    return callback();
  } catch {
    return null;
  }
}

/** A nonblank identifier is intentionally not normalized before storage. */
export function isDatedTrainingId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Existing WOD actions preserve content but trim a title, defaulting when it is blank. */
export function datedTrainingTitle(value: string, fallback: string): string {
  return value.trim() || fallback;
}

/** Avoid Date.UTC's legacy 1900 offset for years 0000–0099. */
export function datedTrainingCalendarDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

export function isStoredDatedTrainingDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = datedTrainingCalendarDate(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function isDatedTrainingInstant(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

/**
 * Mirrors the dated production action parser: JavaScript calendar overflow is
 * normalized before persistence, but only finite serializable dates are kept.
 */
export function normalizeDatedTrainingActionDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    const normalized = date.toISOString().slice(0, 10);
    return isStoredDatedTrainingDate(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/** Closed-state records have ordinary prototypes, enumerable data fields, and no extras. */
export function datedTrainingRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> | null {
  return safe(() => {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
    const allowed = [...required, ...optional];
    const keys = Reflect.ownKeys(value);
    if (keys.length < required.length || keys.length > allowed.length || !keys.every((key) => typeof key === "string" && allowed.includes(key))) return null;
    if (!required.every((key) => keys.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    }
    return Object.fromEntries(keys.map((key) => [key, descriptors[key as string]!.value]));
  });
}

/** Frozen, ordinary dense arrays are valid; sparse arrays, subclasses, accessors, and extras are not. */
export function datedTrainingDenseArray(value: unknown): unknown[] | null {
  return safe(() => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !("value" in length) || !Number.isSafeInteger(length.value) || length.value < 0 || length.enumerable) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length.value + 1 || !keys.every((key) => key === "length" || (typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value))) return null;
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

/**
 * The production group-delete transaction always marks the group, physically
 * removes its memberships, and nulls (but does not retag) dated GROUP rows.
 * Authorization, namespace validation, and timestamp policy remain in each
 * closed engine.
 */
export function detachDatedTrainingGroup<
  Group extends { id: string; deletedAt: string | null },
  Membership extends { groupId: string },
  Wod extends { targetGroupId: string | null },
>(
  groups: readonly Group[],
  memberships: readonly Membership[],
  wods: readonly Wod[],
  groupId: string,
  deletedAt: string,
): { groups: Group[]; memberships: Membership[]; wods: Wod[] } {
  return {
    groups: groups.map((group) => group.id === groupId ? { ...group, deletedAt } : group),
    memberships: memberships.filter((membership) => membership.groupId !== groupId),
    wods: wods.map((wod) => wod.targetGroupId === groupId ? { ...wod, targetGroupId: null } : wod),
  };
}

export function frozenDatedTrainingSnapshot<T extends Record<string, unknown>>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}
