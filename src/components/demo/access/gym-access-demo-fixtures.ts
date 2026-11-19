// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getGymFinancePeople } from "../finance/gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_DEMO_ADMIN_ID, getGymDemoProfile } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_ACCESS_DEMO_NAMESPACE, GYM_ACCESS_DEMO_VERSION } from "./gym-access-demo-types.ts";
import type { GymAccessDemoState, GymAccessStudent } from "./gym-access-demo-types";

/** Reserved default; the live provider always passes today's real Argentina anchor. */
export const GYM_ACCESS_DEMO_DEFAULT_ANCHOR = "2030-06-03";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function shiftDate(anchor: string, days: number): string {
  const [year, month, day] = anchor.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day + days);
  date.setUTCHours(0, 0, 0, 0);
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function argentinaInstant(day: string, hour: number, minute: number): string {
  return `${day}T${String(hour + 3).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

/** Canonical GYM finance roster is the only source of demo people and IDs; own copy, never BOX's. */
export function getGymAccessDemoStudents(anchor: string = GYM_ACCESS_DEMO_DEFAULT_ANCHOR): GymAccessStudent[] {
  const safeAnchor = validDate(anchor) ? anchor : GYM_ACCESS_DEMO_DEFAULT_ANCHOR;
  return getGymFinancePeople(safeAnchor).map((student) => ({
    ...student,
    assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })),
  }));
}

export function getGymAccessDemoStudentIds(): readonly string[] {
  return getGymAccessDemoStudents().map((student) => student.id);
}

/** The canonical directory already carries a stable member number per GYM identity. */
export function getGymAccessDemoMemberNumber(studentId: string): number | null {
  const profile = getGymDemoProfile(studentId);
  return profile && profile.role === "STUDENT" ? profile.memberNumber : null;
}

export function getGymAccessDemoOperatorName(actorId: unknown): string | null {
  if (typeof actorId !== "string") return null;
  const profile = getGymDemoProfile(actorId);
  return profile && profile.role === "ADMIN" ? profile.name : null;
}

/**
 * Fictional historic access rows use only canonical GYM student IDs. Pending rows
 * represent a simulated historic QR flow; no QR token or scanner is implemented.
 */
export function createGymAccessDemoFixture(anchor: string = GYM_ACCESS_DEMO_DEFAULT_ANCHOR): GymAccessDemoState {
  const safeAnchor = validDate(anchor) ? anchor : GYM_ACCESS_DEMO_DEFAULT_ANCHOR;
  const students = getGymAccessDemoStudents(safeAnchor);
  const active = students.filter((student) => !student.deletedAt);
  const days = [0, 0, 0, 0, -1, -1, -1, -2, -2, -3];
  const times: ReadonlyArray<readonly [number, number]> = [
    [9, 10], [9, 25], [10, 5], [10, 40], [8, 50], [9, 15], [10, 0], [9, 5], [9, 45], [10, 20],
  ];
  const states = ["GRANTED", "GRANTED", "DENIED", "PENDING", "GRANTED", "GRANTED", "PENDING", "GRANTED", "DENIED", "GRANTED"] as const;
  return {
    version: GYM_ACCESS_DEMO_VERSION,
    namespace: GYM_ACCESS_DEMO_NAMESPACE,
    logs: states.map((state, index) => {
      const at = argentinaInstant(shiftDate(safeAnchor, days[index]), times[index][0], times[index][1]);
      const decided = state !== "PENDING";
      return {
        id: `gym-access-demo-history-${index + 1}`,
        userId: active[index % active.length].id,
        at,
        state,
        decidedById: state === "DENIED" ? GYM_DEMO_ADMIN_ID : null,
        decidedAt: decided && state === "DENIED" ? at : null,
      };
    }),
  };
}
