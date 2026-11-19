"use client";

import { registerSale } from "@/actions/sale";
import {
  NewSaleDialogView,
  type ProductCatalogItem,
  type SaleRegistrationCallback,
} from "@/components/sales/NewSaleDialogView";

export type { ProductCatalogItem } from "@/components/sales/NewSaleDialogView";

interface Props {
  products: ProductCatalogItem[];
  open: boolean;
  onClose: () => void;
}

/** Production adapter: preserves the action's existing positional arguments and result contract. */
export const registerLiveSale: SaleRegistrationCallback = (productId, quantity, unitAmount, options) =>
  registerSale(productId, quantity, unitAmount, options);

/** Public production API retained for existing Caja callers. */
export function NewSaleDialog({ products, open, onClose }: Props) {
  return (
    <NewSaleDialogView
      products={products}
      open={open}
      onClose={onClose}
      onRegisterSale={registerLiveSale}
    />
  );
}
