import type { FinanceCategory, FinanceProduct } from "./finance-demo-types";

/**
 * Closed, deterministic demo-only catalog. These records are copied into each
 * fixture so browser state and injected state never share mutable aliases.
 */
const DEMO_CATEGORIES: readonly FinanceCategory[] = [
  { id: "finance-category-drinks", name: "Bebidas" },
  { id: "finance-category-accessories", name: "Accesorios" },
];

const DEMO_PRODUCTS: readonly FinanceProduct[] = [
  {
    id: "finance-product-water",
    code: 1,
    description: "Agua mineral",
    categoryId: "finance-category-drinks",
    priceCents: 1_500,
    stock: 12,
    deletedAt: null,
  },
  {
    id: "finance-product-wrist-wraps",
    code: 2,
    description: "Muñequeras",
    categoryId: "finance-category-accessories",
    priceCents: 8_500,
    stock: 4,
    deletedAt: null,
  },
];

export function getCatalogSalesFixtures(): { categories: FinanceCategory[]; products: FinanceProduct[]; nextProductCode: number } {
  return {
    categories: DEMO_CATEGORIES.map((category) => ({ ...category })),
    products: DEMO_PRODUCTS.map((product) => ({ ...product })),
    nextProductCode: 3,
  };
}
