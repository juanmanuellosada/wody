export interface ProductCatalogItem {
  id: string;
  code: number;
  description: string;
  salePrice: number;
  stock: number;
  categoryName: string;
}

export type SalePaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";

export type SaleRegistrationOptions = {
  soldAtStr: string;
  paymentMethod: SalePaymentMethod;
};

/** Matches the public result contract returned by the production sale action. */
export type SaleRegistrationResult =
  | { success: true }
  | { success: false; error: string };

/**
 * The presentation layer preserves the production action's positional input
 * contract. Adapters may apply their own persistence constraints.
 */
export type SaleRegistrationCallback = (
  productId: string,
  quantity: number,
  unitAmount: number,
  options: SaleRegistrationOptions,
) => Promise<SaleRegistrationResult>;

/** Optional calendar source for local adapters; omission keeps the UTC live default. */
export type SaleDatePolicy = {
  today: () => string;
};

/** Resolves the date that initializes and bounds a sale form. */
export function resolveSaleToday(datePolicy?: SaleDatePolicy): string {
  return datePolicy?.today() ?? new Date().toISOString().slice(0, 10);
}
