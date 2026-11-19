"use client";

import { PaymentHistorySection } from "@/components/PaymentHistorySection";
import { SaleHistorySection } from "@/components/SaleHistorySection";
import { ExpenseHistorySection } from "@/components/ExpenseHistorySection";
import { MixtaHistoryTabsView } from "@/components/finance/MixtaHistoryTabsView";
import type { PaymentRecord } from "@/components/PaymentHistorySection";
import type { SaleRecord } from "@/components/SaleHistorySection";
import type { ExpenseRecord } from "@/components/ExpenseHistorySection";

interface Props {
  payments: PaymentRecord[];
  sales: SaleRecord[];
  expenses: ExpenseRecord[];
}

/** Production history adapter; inactive tab slots intentionally stay unmounted. */
export function MixtaHistoryTabs({ payments, sales, expenses }: Props) {
  return (
    <MixtaHistoryTabsView
      cuotas={<PaymentHistorySection payments={payments} isAdmin />}
      ventas={<SaleHistorySection sales={sales} />}
      gastos={<ExpenseHistorySection expenses={expenses} />}
    />
  );
}
