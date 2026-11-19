export type FinancePaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";

/** Serializable payment row supplied by the caller. */
export interface PaymentHistoryRecord {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  paidAt: string;
  recordedByName: string;
  paymentMethod: FinancePaymentMethod | null;
}

/** Serializable sale row supplied by the caller. */
export interface SaleHistoryRecord {
  id: string;
  productCode: number;
  productDescription: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  paymentMethod: FinancePaymentMethod;
  soldAt: string;
  recordedByName: string;
}

/** Serializable expense row supplied by the caller. */
export interface ExpenseHistoryRecord {
  id: string;
  amount: number;
  description: string;
  spentAt: string;
  recordedByName: string;
}

/** Matches the static discriminated result returned by the production payment action. */
export type PaymentHistoryMutationResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; requiresConfirmation: true; duplicateInfo: { studentName: string; paidAt: string } };

/** Matches the non-confirmation result shared by the sale and expense history actions. */
export type HistoryMutationResult =
  | { success: true }
  | { success: false; error: string };

export type UpdatePaymentCallback = (paymentId: string, amount: number) => Promise<PaymentHistoryMutationResult>;
export type DeletePaymentCallback = (paymentId: string) => Promise<PaymentHistoryMutationResult>;
export type UpdateSaleCallback = (
  saleId: string,
  data: { quantity?: number; unitAmount?: number },
) => Promise<HistoryMutationResult>;
export type DeleteSaleCallback = (saleId: string) => Promise<HistoryMutationResult>;
export type UpdateExpenseCallback = (
  expenseId: string,
  data: { amount?: number; description?: string },
) => Promise<HistoryMutationResult>;
export type DeleteExpenseCallback = (expenseId: string) => Promise<HistoryMutationResult>;
