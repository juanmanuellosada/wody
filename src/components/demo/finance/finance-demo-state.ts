// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { demoFeeIdentities, getDemoFeeFixtures } from "./fees-fixtures.ts";
import type {
  FinanceActor,
  FinanceDemoState,
  FinanceFixtureOptions,
  FinancePayment,
  FinancePaymentMethod,
  FinancePaymentResult,
  FinanceStudent,
  FinanceTransition,
} from "./finance-demo-types";

const FINANCE_DEMO_NAMESPACE = "wody-box-finance-demo";
const FINANCE_DEMO_VERSION = 1;
const FINANCE_DEMO_DEFAULT_ANCHOR = "2030-06-03";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_METHODS: readonly FinancePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];
const MAX_CENTS = 999_999_999_999;

type ResolvedPaymentCommand = {
  id: string;
  commandId: string;
  studentId: string;
  amountCents: number;
  paidAt: string;
  nextPaymentDate: string;
  paymentMethod: FinancePaymentMethod;
  confirmedDuplicate: boolean;
};

function transition(state: FinanceDemoState, result: FinancePaymentResult): FinanceTransition {
  return { state, result };
}

function failure(state: FinanceDemoState, error: string): FinanceTransition {
  return transition(state, { success: false, error });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isFinanceDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

function isPaymentMethod(value: unknown): value is FinancePaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.includes(value as FinancePaymentMethod);
}

/** Strict demo-only decimal parsing. Production retains its established parseFloat conversion. */
export function parseFinanceAmountCents(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const wholeCents = Number(whole) * 100;
  const fractionCents = fraction.length === 0 ? 0 : Number(fraction.padEnd(2, "0"));
  const cents = wholeCents + fractionCents;
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= MAX_CENTS ? cents : null;
}

function knownActor(value: unknown): FinanceActor | null {
  if (!isRecord(value) || !isId(value.id) || (value.role !== "ADMIN" && value.role !== "TEACHER")) return null;
  const actor = Object.values(demoFeeIdentities).find((candidate) => candidate.id === value.id);
  return actor && actor.role === value.role ? actor : null;
}

function activeStudent(state: FinanceDemoState, value: unknown): FinanceStudent | null {
  if (!isId(value)) return null;
  const student = state.students.find((candidate) => candidate.id === value);
  return student && !student.deletedAt ? student : null;
}

function canRecordPayment(student: FinanceStudent, actor: FinanceActor): boolean {
  return actor.role === "ADMIN" || student.assignedTeachers.some((teacher) => teacher.id === actor.id);
}

function resolveCommand(value: unknown): ResolvedPaymentCommand | null {
  if (!isRecord(value) || !isId(value.id) || !isId(value.commandId) || !isId(value.studentId)) return null;
  const amountCents = parseFinanceAmountCents(value.amountInput);
  if (amountCents === null || !isFinanceDate(value.paidAt) || !isFinanceDate(value.nextPaymentDate) || !isPaymentMethod(value.paymentMethod) || typeof value.confirmedDuplicate !== "boolean") return null;
  return {
    id: value.id,
    commandId: value.commandId,
    studentId: value.studentId,
    amountCents,
    paidAt: value.paidAt,
    nextPaymentDate: value.nextPaymentDate,
    paymentMethod: value.paymentMethod,
    confirmedDuplicate: value.confirmedDuplicate,
  };
}

function samePayload(payment: FinancePayment, command: ResolvedPaymentCommand, actor: FinanceActor): boolean {
  return payment.id === command.id
    && payment.studentId === command.studentId
    && payment.amountCents === command.amountCents
    && payment.paidAt === command.paidAt
    && payment.nextPaymentDate === command.nextPaymentDate
    && payment.paymentMethod === command.paymentMethod
    && payment.recordedById === actor.id;
}

function paymentDateIsFuture(paidAt: string, today: string): boolean {
  return paidAt > today;
}

/** Adds one UTC calendar month without exposing a Date instance to demo state. */
export function suggestNextFinancePaymentDate(nextPaymentDate: string): string {
  if (!isFinanceDate(nextPaymentDate)) return "";
  const [year, month, day] = nextPaymentDate.split("-").map(Number);
  const targetMonth = month === 12 ? 1 : month + 1;
  const targetYear = month === 12 ? year + 1 : year;
  const monthLastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear.toString().padStart(4, "0")}-${targetMonth.toString().padStart(2, "0")}-${Math.min(day, monthLastDay).toString().padStart(2, "0")}`;
}

/** Builds deterministic local state from the established F5a fixtures. Optional history is expressly fictional. */
export function createFinanceDemoFixture(
  anchor: string = FINANCE_DEMO_DEFAULT_ANCHOR,
  options?: FinanceFixtureOptions,
): FinanceDemoState {
  const safeAnchor = isFinanceDate(anchor) ? anchor : FINANCE_DEMO_DEFAULT_ANCHOR;
  const payments = (options?.fictionalSeedPayments ?? []).map((payment, index) => ({
    ...payment,
    id: payment.id ?? `fictional-finance-payment-${index + 1}`,
    commandId: payment.commandId ?? `fictional-finance-command-${index + 1}`,
  }));
  return {
    version: FINANCE_DEMO_VERSION,
    namespace: FINANCE_DEMO_NAMESPACE,
    anchor: safeAnchor,
    students: getDemoFeeFixtures(safeAnchor).map((student) => ({ ...student, assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })) })),
    payments,
  };
}

/**
 * A reducer command creates only a fictional local payment. It never changes
 * profile, exemption, block, assignment, or any production record.
 */
export function registerFinancePayment(
  state: FinanceDemoState,
  rawCommand: unknown,
  today: string = state.anchor,
): FinanceTransition {
  if (!state || !Array.isArray(state.students) || !Array.isArray(state.payments)) return failure(state, "El estado financiero no es válido.");
  const rawActor = isRecord(rawCommand) ? rawCommand.actor : undefined;
  const actor = knownActor(rawActor);
  if (!actor) return failure(state, "No autorizado.");

  // Authorize the current actor before considering any idempotent replay.
  const student = activeStudent(state, isRecord(rawCommand) ? rawCommand.studentId : undefined);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (!canRecordPayment(student, actor)) return failure(state, "Este alumno no está asignado a vos.");

  const command = resolveCommand(rawCommand);
  if (!command) return failure(state, "El pago no es válido.");
  if (!isFinanceDate(today)) return failure(state, "La fecha actual no es válida.");
  if (paymentDateIsFuture(command.paidAt, today)) return failure(state, "La fecha del pago no puede ser futura.");

  const existingCommand = state.payments.find((payment) => payment.commandId === command.commandId);
  if (existingCommand) {
    return samePayload(existingCommand, command, actor)
      ? transition(state, { success: true, paymentId: existingCommand.id, idempotent: true })
      : failure(state, "El identificador del comando ya fue usado con otro pago.");
  }
  if (state.payments.some((payment) => payment.id === command.id)) return failure(state, "Identificador de pago inválido.");

  const duplicate = state.payments.find((payment) => payment.studentId === student.id && payment.paidAt === command.paidAt);
  if (duplicate && !command.confirmedDuplicate) {
    return transition(state, {
      success: false,
      requiresConfirmation: true,
      duplicateInfo: { studentName: student.name, paidAt: command.paidAt },
    });
  }

  const payment: FinancePayment = {
    id: command.id,
    commandId: command.commandId,
    studentId: student.id,
    amountCents: command.amountCents,
    paidAt: command.paidAt,
    nextPaymentDate: command.nextPaymentDate,
    paymentMethod: command.paymentMethod,
    recordedById: actor.id,
  };
  return transition(
    {
      ...state,
      students: state.students.map((candidate) => candidate.id === student.id
        ? { ...candidate, nextPaymentDate: command.nextPaymentDate }
        : candidate),
      payments: [...state.payments, payment],
    },
    { success: true, paymentId: payment.id, idempotent: false },
  );
}
