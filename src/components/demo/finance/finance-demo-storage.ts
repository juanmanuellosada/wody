// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { demoFeeIdentities, getDemoFeeFixtures } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createFinanceDemoFixture, isFinanceDate } from "./finance-demo-state.ts";
import type { FinanceDemoState, FinancePaymentMethod } from "./finance-demo-types";

const FINANCE_DEMO_NAMESPACE = "wody-box-finance-demo";
const FINANCE_DEMO_VERSION = 1;
const FINANCE_DEMO_STORAGE_KEY = "wody-box-finance-demo-v1";
const PAYMENT_METHODS: readonly FinancePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];

export type FinanceDemoStorage = Pick<Storage, "getItem" | "setItem">;
export type FinanceStorageLoad = { state: FinanceDemoState; warning: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPaymentMethod(value: unknown): value is FinancePaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.includes(value as FinancePaymentMethod);
}

/** Array.prototype.every skips holes, so validate density before relation traversal or Map construction. */
function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) return false;
  }
  return true;
}

function sameArray(left: unknown, right: unknown): boolean {
  return isDenseArray(left)
    && isDenseArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

/** State keeps fixture metadata closed: only an active student's next due date is mutable. */
function hasFixtureStudentMetadata(state: Record<string, unknown>): boolean {
  if (!isFinanceDate(state.anchor) || !isDenseArray(state.students)) return false;
  const fixtures = getDemoFeeFixtures(state.anchor);
  if (state.students.length !== fixtures.length) return false;
  const seenIds = new Set<string>();
  return state.students.every((student) => {
    if (!isRecord(student) || !isId(student.id) || !isFinanceDate(student.nextPaymentDate) || !isDenseArray(student.assignedTeachers)) return false;
    if (seenIds.has(student.id)) return false;
    seenIds.add(student.id);
    const fixture = fixtures.find((candidate) => candidate.id === student.id);
    if (!fixture) return false;
    return student.name === fixture.name
      && student.email === fixture.email
      && student.studentType === fixture.studentType
      && student.accountKind === fixture.accountKind
      && student.canCreateOwnRoutines === fixture.canCreateOwnRoutines
      && student.paymentExempt === fixture.paymentExempt
      && student.paymentExemptReason === fixture.paymentExemptReason
      && student.blocked === fixture.blocked
      && student.deletedAt === fixture.deletedAt
      && sameArray(
        student.assignedTeachers.map((teacher) => isRecord(teacher) ? `${teacher.id}:${teacher.name}` : null),
        fixture.assignedTeachers.map((teacher) => `${teacher.id}:${teacher.name}`),
      );
  });
}

function knownRecorder(id: string): boolean {
  return Object.values(demoFeeIdentities).some((identity) => identity.id === id);
}

/** Reject any malformed relation rather than attempting a partial merge of persisted history. */
export function isValidFinanceDemoState(value: unknown): value is FinanceDemoState {
  if (!isRecord(value)
    || value.version !== FINANCE_DEMO_VERSION
    || value.namespace !== FINANCE_DEMO_NAMESPACE
    || !hasFixtureStudentMetadata(value)
    || !isDenseArray(value.payments)
    || !isDenseArray(value.students)) return false;
  const students = value.students as Record<string, unknown>[];
  const studentById = new Map(students.map((student) => [student.id as string, student]));
  const paymentIds = new Set<string>();
  const commandIds = new Set<string>();

  return value.payments.every((payment) => {
    if (!isRecord(payment)
      || !isId(payment.id)
      || !isId(payment.commandId)
      || !isId(payment.studentId)
      || typeof payment.amountCents !== "number"
      || !Number.isSafeInteger(payment.amountCents)
      || payment.amountCents < 1
      || payment.amountCents > 999_999_999_999
      || !isFinanceDate(payment.paidAt)
      || !isFinanceDate(payment.nextPaymentDate)
      || !isPaymentMethod(payment.paymentMethod)
      || !isId(payment.recordedById)) return false;
    if (paymentIds.has(payment.id) || commandIds.has(payment.commandId)) return false;
    paymentIds.add(payment.id);
    commandIds.add(payment.commandId);
    const student = studentById.get(payment.studentId);
    if (!student || student.deletedAt) return false;
    if (!knownRecorder(payment.recordedById)) return false;
    const recorder = Object.values(demoFeeIdentities).find((identity) => identity.id === payment.recordedById);
    return recorder?.role === "ADMIN" || (isDenseArray(student.assignedTeachers) && student.assignedTeachers.some((teacher) => isRecord(teacher) && teacher.id === recorder?.id));
  });
}

export function serializeFinanceDemoState(state: FinanceDemoState): string {
  if (!isValidFinanceDemoState(state)) throw new Error("Cannot serialize an invalid finance demo state.");
  return JSON.stringify(state);
}

/** Valid storage wins; only then may an injected, fully validated state be used as the fallback. */
export function resolveFinanceDemoInitialState(
  raw: string | null | undefined,
  fallback?: unknown,
): FinanceStorageLoad {
  const safeFallback = isValidFinanceDemoState(fallback) ? fallback : createFinanceDemoFixture();
  if (!raw) return { state: safeFallback, warning: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValidFinanceDemoState(parsed)
      ? { state: parsed, warning: null }
      : { state: safeFallback, warning: "El estado financiero guardado no es válido; se usó el estado de respaldo." };
  } catch {
    return { state: safeFallback, warning: "El estado financiero guardado no es válido; se usó el estado de respaldo." };
  }
}

export function loadFinanceDemoState(
  storage: FinanceDemoStorage | null | undefined,
  fallback?: unknown,
): FinanceStorageLoad {
  const safeFallback = isValidFinanceDemoState(fallback) ? fallback : createFinanceDemoFixture();
  if (!storage) return { state: safeFallback, warning: "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán." };
  try {
    return resolveFinanceDemoInitialState(storage.getItem(FINANCE_DEMO_STORAGE_KEY), safeFallback);
  } catch {
    return { state: safeFallback, warning: "No se pudo leer el almacenamiento de esta pestaña; se usó el estado de respaldo." };
  }
}

export function persistFinanceDemoState(storage: FinanceDemoStorage | null | undefined, state: FinanceDemoState): string | null {
  if (!storage) return "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.";
  try {
    storage.setItem(FINANCE_DEMO_STORAGE_KEY, serializeFinanceDemoState(state));
    return null;
  } catch {
    return "No se pudieron guardar los cambios; el demo continúa solo en memoria.";
  }
}
