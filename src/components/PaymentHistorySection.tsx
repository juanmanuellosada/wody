"use client";

import { updatePayment, deletePayment } from "@/actions/payment";
import {
  PaymentHistorySectionView,
  type UpdatePaymentCallback,
  type DeletePaymentCallback,
} from "@/components/payments/PaymentHistorySectionView";
import type { PaymentHistoryRecord } from "@/components/finance/history-view-contracts";

export type {
  FinancePaymentMethod as PaymentMethod,
  PaymentHistoryMutationResult,
  PaymentHistoryRecord as PaymentRecord,
  UpdatePaymentCallback,
  DeletePaymentCallback,
} from "@/components/payments/PaymentHistorySectionView";

interface Props {
  payments: PaymentHistoryRecord[];
  isAdmin: boolean;
}

/** Production adapters retain the live payment action argument and result contracts. */
export const updateLivePayment: UpdatePaymentCallback = (paymentId, amount) => updatePayment(paymentId, amount);
export const deleteLivePayment: DeletePaymentCallback = (paymentId) => deletePayment(paymentId);

/** Public production API retained for RevenuePanel and MixtaHistoryTabs callers. */
export function PaymentHistorySection({ payments, isAdmin }: Props) {
  return (
    <PaymentHistorySectionView
      payments={payments}
      isAdmin={isAdmin}
      onUpdatePayment={updateLivePayment}
      onDeletePayment={deleteLivePayment}
    />
  );
}
