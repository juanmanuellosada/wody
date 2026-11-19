import type { FeeIdentity, FeeStudent } from "./fees-contract";

export const FINANCE_DEMO_NAMESPACE = "wody-box-finance-demo";
export const FINANCE_DEMO_VERSION = 3;
export const FINANCE_DEMO_STORAGE_KEY = "wody-box-finance-demo-v3";
export const FINANCE_DEMO_V2_STORAGE_KEY = "wody-box-finance-demo-v2";
export const FINANCE_DEMO_LEGACY_STORAGE_KEY = "wody-box-finance-demo-v1";
export const FINANCE_DEMO_DEFAULT_ANCHOR = "2030-06-03";
export const GYM_FINANCE_DEMO_NAMESPACE = "wody-gym-finance-demo";
export const GYM_FINANCE_DEMO_VERSION = 1;
/** Reserved for the future isolated GYM provider; no storage I/O is implemented here. */
export const GYM_FINANCE_DEMO_STORAGE_KEY = "wody-gym-finance-demo-v1";
export const GYM_FINANCE_DEMO_DEFAULT_ANCHOR = "2030-06-03";

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

export type FinanceCategory = {
  id: string;
  name: string;
};

export type FinanceProduct = {
  id: string;
  code: number;
  description: string;
  categoryId: string;
  priceCents: number;
  stock: number;
  deletedAt: string | null;
};

/** Sale amounts are snapshots; product changes never rewrite them. */
export type FinanceSale = {
  id: string;
  commandId: string;
  productId: string;
  quantity: number;
  unitAmountCents: number;
  totalAmountCents: number;
  paymentMethod: FinancePaymentMethod;
  soldAt: string;
  recordedById: string;
};

/** Expense amounts are positive Decimal(12,2) values represented as integer cents. */
export type FinanceExpense = {
  id: string;
  amountCents: number;
  description: string;
  spentAt: string;
  recordedById: string;
};

type FinanceDemoBaseState = {
  namespace: typeof FINANCE_DEMO_NAMESPACE;
  anchor: string;
  students: FinanceStudent[];
  payments: FinancePayment[];
};

export type FinanceDemoV2State = FinanceDemoBaseState & {
  version: 2;
  categories: FinanceCategory[];
  products: FinanceProduct[];
  sales: FinanceSale[];
  nextProductCode: number;
};

/** No actor or capability is persisted: each command proves its identity against the frozen roster. */
export type FinanceDemoState = Omit<FinanceDemoV2State, "version"> & {
  version: typeof FINANCE_DEMO_VERSION;
  expenses: FinanceExpense[];
};

/** A separate v1 namespace avoids coupling GYM finance persistence to BOX migrations. */
export type GymFinanceDemoState = Omit<FinanceDemoState, "version" | "namespace"> & {
  version: typeof GYM_FINANCE_DEMO_VERSION;
  namespace: typeof GYM_FINANCE_DEMO_NAMESPACE;
};

/** Reducers retain the caller's narrow state type across the closed BOX/GYM union. */
export type KnownFinanceDemoState = FinanceDemoState | GymFinanceDemoState;

/** The version-1 graph is read only so migration remains explicit and testable. */
export type FinanceDemoLegacyState = Omit<FinanceDemoV2State, "version" | "categories" | "products" | "sales" | "nextProductCode"> & {
  version: 1;
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

/** Shared result shape for the profile commands (name, block, exemption, teacher assignment). */
export type FinanceProfileResult = { success: true } | { success: false; error: string };

/** Optional history is expressly fictional and never mutates the fixture students' base due dates. */
export type FictionalFinanceSeedPayment = Omit<FinancePayment, "id" | "commandId"> & {
  id?: string;
  commandId?: string;
};

export type FinanceFixtureOptions = {
  fictionalSeedPayments?: readonly FictionalFinanceSeedPayment[];
};
