// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { financeCatalogSaleActors } from "../finance/catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { demoFeeIdentities, getDemoFeeFixtures } from "../finance/fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { ACCESS_DEMO_DEFAULT_ANCHOR, ACCESS_DEMO_NAMESPACE, ACCESS_DEMO_VERSION } from "./access-demo-types.ts";
import type { AccessDemoState, AccessStudent } from "./access-demo-types";

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

/** Canonical finance fixture roster is the only source of demo people and IDs. */
export function getAccessDemoStudents(anchor: string = ACCESS_DEMO_DEFAULT_ANCHOR): AccessStudent[] {
  const safeAnchor = validDate(anchor) ? anchor : ACCESS_DEMO_DEFAULT_ANCHOR;
  return getDemoFeeFixtures(safeAnchor).map((student) => ({
    ...student,
    assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })),
  }));
}

export function getAccessDemoStudentIds(): readonly string[] {
  return getAccessDemoStudents().map((student) => student.id);
}

/** Immutable labels resolve only known finance ADMIN IDs and are never copied into access storage. */
const accessOperatorNames: Readonly<Record<string, string>> = Object.freeze({
  [demoFeeIdentities.admin.id]: demoFeeIdentities.admin.name,
  [financeCatalogSaleActors.unprivilegedAdmin.id]: "Administrador sin acceso a recaudación",
});

export function getAccessDemoOperatorName(actorId: unknown): string | null {
  if (typeof actorId !== "string" || !Object.hasOwn(accessOperatorNames, actorId)) return null;
  const label = accessOperatorNames[actorId];
  return typeof label === "string" ? label : null;
}

/**
 * Fictional historic access rows use only canonical student IDs. Pending rows
 * represent simulated historic QR flow; no QR token or scanner is implemented.
 */
export function createAccessDemoFixture(anchor: string = ACCESS_DEMO_DEFAULT_ANCHOR): AccessDemoState {
  const safeAnchor = validDate(anchor) ? anchor : ACCESS_DEMO_DEFAULT_ANCHOR;
  const students = getAccessDemoStudents(safeAnchor);
  const active = students.filter((student) => !student.deletedAt);
  const days = [0, 0, 0, 0, 0, -1, -1, -1, -1, -2, -2, -2, -3, -3, -3];
  const times: ReadonlyArray<readonly [number, number]> = [
    [9, 5], [9, 12], [9, 30], [10, 2], [10, 45], [8, 55], [9, 20], [10, 10], [11, 0], [9, 5], [9, 40], [10, 15], [8, 50], [9, 33], [10, 55],
  ];
  const states = ["GRANTED", "GRANTED", "DENIED", "GRANTED", "PENDING", "GRANTED", "GRANTED", "GRANTED", "PENDING", "GRANTED", "DENIED", "GRANTED", "GRANTED", "GRANTED", "DENIED"] as const;
  return {
    version: ACCESS_DEMO_VERSION,
    namespace: ACCESS_DEMO_NAMESPACE,
    logs: states.map((state, index) => {
      const at = argentinaInstant(shiftDate(safeAnchor, days[index]), times[index][0], times[index][1]);
      const decided = state !== "PENDING";
      return {
        id: `access-demo-history-${index + 1}`,
        userId: active[index % active.length].id,
        at,
        state,
        decidedById: state === "DENIED" ? "finance-admin" : null,
        decidedAt: decided && state === "DENIED" ? at : null,
      };
    }),
  };
}
