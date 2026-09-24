// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getCatalogSalesFixtures } from "./catalog-sales-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getDemoFeeFixtures } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { FINANCE_DEMO_DEFAULT_ANCHOR, FINANCE_DEMO_NAMESPACE, FINANCE_DEMO_VERSION } from "./finance-demo-types.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesFinanceState, actorMatchesOwnedFinanceState, canRecordFinancePayment, isGymFinanceActor, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
import type { GymFinanceTeacherStudentLink } from "./finance-demo-policy";
import type {
  FinanceDemoState,
  KnownFinanceDemoState,
  FinanceFixtureOptions,
  FinancePayment,
  FinancePaymentMethod,
  FinancePaymentResult,
  FinanceStudent,
} from "./finance-demo-types";
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

function transition<T extends KnownFinanceDemoState>(state: T, result: FinancePaymentResult): { state: T; result: FinancePaymentResult } {
  return { state, result };
}

function failure<T extends KnownFinanceDemoState>(state: T, error: string): { state: T; result: FinancePaymentResult } {
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

function readableState<T extends KnownFinanceDemoState>(state: T, actor: NonNullable<ReturnType<typeof resolveFinanceDemoActor>>): KnownFinanceDemoState | null {
  if (!isGymFinanceActor(actor)) return actorMatchesFinanceState(actor, state) ? state : null;
  if (!actorMatchesFinanceState(actor, state)) return null;
  const owned = getValidatedGymFinanceDemoState(state);
  return owned && actorMatchesOwnedFinanceState(actor, owned) ? owned : null;
}

function activeStudent(state: KnownFinanceDemoState, value: unknown): FinanceStudent | null {
  if (!isId(value)) return null;
  const student = state.students.find((candidate) => candidate.id === value);
  return student && !student.deletedAt ? student : null;
}

function canRecordPayment(
  student: FinanceStudent,
  actor: NonNullable<ReturnType<typeof resolveFinanceDemoActor>>,
  gymTeacherStudentLinks: readonly GymFinanceTeacherStudentLink[] | undefined,
): boolean {
  return canRecordFinancePayment(actor, student.id, student.assignedTeachers.map((teacher) => teacher.id), gymTeacherStudentLinks);
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

function samePayload(payment: FinancePayment, command: ResolvedPaymentCommand, actor: NonNullable<ReturnType<typeof resolveFinanceDemoActor>>): boolean {
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
  const catalog = getCatalogSalesFixtures();
  return {
    version: FINANCE_DEMO_VERSION,
    namespace: FINANCE_DEMO_NAMESPACE,
    anchor: safeAnchor,
    students: getDemoFeeFixtures(safeAnchor).map((student) => ({ ...student, assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })) })),
    payments,
    categories: catalog.categories,
    products: catalog.products,
    sales: [],
    expenses: [],
    nextProductCode: catalog.nextProductCode,
  };
}

/**
 * A reducer command creates only a fictional local payment. It never changes
 * profile, exemption, block, assignment, or any production record.
 */
export function registerFinancePayment<T extends KnownFinanceDemoState>(
  state: T,
  rawCommand: unknown,
  today?: string,
  gymTeacherStudentLinks?: readonly GymFinanceTeacherStudentLink[],
): { state: T; result: FinancePaymentResult } {
  const rawActor = isRecord(rawCommand) ? rawCommand.actor : undefined;
  const actor = resolveFinanceDemoActor(rawActor);
  if (!actor) return failure(state, "No autorizado.");
  const graph = readableState(state, actor);
  if (!graph) return failure(state, "No autorizado.");
  if (!Array.isArray(graph.students) || !Array.isArray(graph.payments)) return failure(state, "El estado financiero no es válido.");

  // GYM semantics use the detached validated graph; BOX retains the original reference behavior.
  const student = activeStudent(graph, isRecord(rawCommand) ? rawCommand.studentId : undefined);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (!canRecordPayment(student, actor, gymTeacherStudentLinks)) return failure(state, "Este alumno no está asignado a vos.");

  const command = resolveCommand(rawCommand);
  if (!command) return failure(state, "El pago no es válido.");
  const effectiveToday = today ?? graph.anchor;
  if (!isFinanceDate(effectiveToday)) return failure(state, "La fecha actual no es válida.");
  if (paymentDateIsFuture(command.paidAt, effectiveToday)) return failure(state, "La fecha del pago no puede ser futura.");

  const existingCommand = graph.payments.find((payment) => payment.commandId === command.commandId);
  if (existingCommand) {
    return samePayload(existingCommand, command, actor)
      ? transition(state, { success: true, paymentId: existingCommand.id, idempotent: true })
      : failure(state, "El identificador del comando ya fue usado con otro pago.");
  }
  if (graph.payments.some((payment) => payment.id === command.id)) return failure(state, "Identificador de pago inválido.");

  const duplicate = graph.payments.find((payment) => payment.studentId === student.id && payment.paidAt === command.paidAt);
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
    // Safe generic narrowing: graph is either the original BOX state or a closed owned GYM graph.
    {
      ...graph,
      students: graph.students.map((candidate) => candidate.id === student.id
        ? { ...candidate, nextPaymentDate: command.nextPaymentDate }
        : candidate),
      payments: [...graph.payments, payment],
    } as T,
    { success: true, paymentId: payment.id, idempotent: false },
  );
}
