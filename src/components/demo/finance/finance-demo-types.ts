import type { FeeIdentity, FeeStudent } from "./fees-contract";

export const FINANCE_DEMO_NAMESPACE = "wody-box-finance-demo";
export const FINANCE_DEMO_VERSION = 1;
export const FINANCE_DEMO_STORAGE_KEY = "wody-box-finance-demo-v1";
export const FINANCE_DEMO_DEFAULT_ANCHOR = "2030-06-03";

export type FinancePaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";

/** Fixture metadata is immutable; only a student's due date changes after a demo payment. */
export type FinanceStudent = FeeStudent;
export type FinanceActor = FeeIdentity;

export type FinancePayment = {
  id: string;
  studentId: string;
  amountCents: number;
  paidAt: string;
  nextPaymentDate: string;
  paymentMethod: FinancePaymentMethod;
  recordedById: string;
  commandId: string;
};

/** No actor is persisted: every command must prove its supplied identity against the fixture roster. */
export type FinanceDemoState = {
  version: typeof FINANCE_DEMO_VERSION;
  namespace: typeof FINANCE_DEMO_NAMESPACE;
  anchor: string;
  students: FinanceStudent[];
  payments: FinancePayment[];
};

export type FinancePaymentCommand = {
  id: unknown;
  commandId: unknown;
  actor: unknown;
  studentId: unknown;
  amountInput: unknown;
  paidAt: unknown;
  nextPaymentDate: unknown;
  paymentMethod: unknown;
  confirmedDuplicate: unknown;
};

export type FinancePaymentResult =
  | { success: true; paymentId: string; idempotent: boolean }
  | { success: false; error: string }
  | { success: false; requiresConfirmation: true; duplicateInfo: { studentName: string; paidAt: string } };

export type FinanceTransition = { state: FinanceDemoState; result: FinancePaymentResult };

/** Optional history is explicitly fictional and never mutates the fixture students' base due dates. */
export type FictionalFinanceSeedPayment = Omit<FinancePayment, "id" | "commandId"> & {
  id?: string;
  commandId?: string;
};

export type FinanceFixtureOptions = {
  fictionalSeedPayments?: readonly FictionalFinanceSeedPayment[];
};
