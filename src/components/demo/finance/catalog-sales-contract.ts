import type { FinancePaymentMethod } from "./finance-demo-types";

export const FINANCE_CATALOG_GYM_KIND = "BOX";
export const POSTGRES_INT_MIN = -2_147_483_648;
export const POSTGRES_INT_MAX = 2_147_483_647;
export const FINANCE_CENTS_MAX = 999_999_999_999;

export type CatalogSaleRole = "ADMIN" | "TEACHER" | "STUDENT" | "ACCESS";
export type CatalogSaleActor = {
  readonly id: string;
  readonly role: CatalogSaleRole;
  readonly canViewRevenue: boolean;
  readonly gymKind: typeof FINANCE_CATALOG_GYM_KIND;
};

/**
 * This roster is the policy source. Commands never trust a role, permission,
 * or tenant claim supplied by a caller.
 */
const catalogSaleActors = {
  admin: Object.freeze({ id: "finance-admin", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" as const }),
  teacher: Object.freeze({ id: "finance-teacher-carlos", role: "TEACHER", canViewRevenue: false, gymKind: "BOX" as const }),
  unprivilegedAdmin: Object.freeze({ id: "finance-admin-unprivileged", role: "ADMIN", canViewRevenue: false, gymKind: "BOX" as const }),
} satisfies Record<"admin" | "teacher" | "unprivilegedAdmin", CatalogSaleActor>;

/** Runtime freezing prevents exported fixture aliases from changing authorization policy. */
export const financeCatalogSaleActors: Readonly<Record<"admin" | "teacher" | "unprivilegedAdmin", CatalogSaleActor>> = Object.freeze(catalogSaleActors);

export type CatalogSaleResult =
  | { success: true; id: string; code?: number; idempotent?: boolean; stockWarning?: boolean }
  | { success: false; error: string };

export type CatalogSaleTransition<State> = { state: State; result: CatalogSaleResult };

export type CreateCategoryCommand = { id: unknown; actor: unknown; name: unknown };
export type UpdateCategoryCommand = { id: unknown; actor: unknown; categoryId: unknown; name: unknown };
export type DeleteCategoryCommand = { id: unknown; actor: unknown; categoryId: unknown };
export type CreateProductCommand = {
  id: unknown;
  actor: unknown;
  description: unknown;
  categoryId: unknown;
  priceCents: unknown;
  stock: unknown;
  code?: unknown;
};
export type UpdateProductCommand = {
  id: unknown;
  actor: unknown;
  productId: unknown;
  description?: unknown;
  categoryId?: unknown;
  priceCents?: unknown;
  stock?: unknown;
  code?: unknown;
};
export type DeleteProductCommand = { id: unknown; actor: unknown; productId: unknown; deletedAt: unknown };
export type RegisterSaleCommand = {
  id: unknown;
  commandId: unknown;
  actor: unknown;
  productId: unknown;
  quantity: unknown;
  unitAmountCents: unknown;
  paymentMethod: unknown;
  soldAt: unknown;
};

export const catalogPaymentMethods: readonly FinancePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];
