"use client";

import { updateSale, deleteSale } from "@/actions/sale";
import {
  SaleHistorySectionView,
  type UpdateSaleCallback,
  type DeleteSaleCallback,
} from "@/components/sales/SaleHistorySectionView";
import type { SaleHistoryRecord } from "@/components/finance/history-view-contracts";

export type {
  FinancePaymentMethod as PaymentMethod,
  SaleHistoryRecord as SaleRecord,
  UpdateSaleCallback,
  DeleteSaleCallback,
} from "@/components/sales/SaleHistorySectionView";

interface Props {
  sales: SaleHistoryRecord[];
}

/** Production adapters retain the live sale action argument and result contracts. */
export const updateLiveSale: UpdateSaleCallback = (saleId, data) => updateSale(saleId, data);
export const deleteLiveSale: DeleteSaleCallback = (saleId) => deleteSale(saleId);

/** Public production API retained for RevenuePanel and MixtaHistoryTabs callers. */
export function SaleHistorySection({ sales }: Props) {
  return <SaleHistorySectionView sales={sales} onUpdateSale={updateLiveSale} onDeleteSale={deleteLiveSale} />;
}
