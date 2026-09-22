"use client";

import { registerLiveSale } from "@/components/NewSaleDialog";
import { NewSaleButtonView } from "@/components/sales/NewSaleButtonView";
import type { ProductCatalogItem } from "@/components/sales/sale-view-contracts";

export type { ProductCatalogItem } from "@/components/sales/sale-view-contracts";

interface Props {
  products: ProductCatalogItem[];
  size?: "sm" | "md" | "lg";
}

/**
 * "Nueva venta" button — disponible en Caja para ADMIN y TEACHER,
 * independientemente de canViewRevenue.
 */
export function NewSaleButton({ products, size = "sm" }: Props) {
  return <NewSaleButtonView products={products} size={size} onRegisterSale={registerLiveSale} />;
}
