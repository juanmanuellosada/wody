import type {
  CreateCategoryCallback,
  CreateProductCallback,
  DeleteCategoryCallback,
  DeleteProductCallback,
  ProductCategoryOption,
  ProductInput,
  ProductRow,
  UpdateCategoryCallback,
  UpdateProductCallback,
} from "@/components/products/product-view-contracts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX } from "./catalog-sales-contract.ts";
import {
  canManageCatalog,
  createCatalogCategory,
  createCatalogProduct,
  deleteCatalogCategory,
  softDeleteCatalogProduct,
  updateCatalogCategory,
  updateCatalogProduct,
  // @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
} from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidFinanceDemoState } from "./finance-demo-storage.ts";
import type { FinanceDemoState } from "./finance-demo-types";

export type CatalogDemoManagementData = {
  categories: ProductCategoryOption[];
  products: ProductRow[];
  previewCode: number;
};

export type CatalogDemoCallbacks = {
  createProduct: CreateProductCallback;
  updateProduct: UpdateProductCallback;
  deleteProduct: DeleteProductCallback;
  createCategory: CreateCategoryCallback;
  updateCategory: UpdateCategoryCallback;
  deleteCategory: DeleteCategoryCallback;
};

type CatalogLocalIdKind = "category" | "product" | "command";

export type CatalogDemoCallbackFactoryOptions = {
  getState: () => FinanceDemoState;
  commit: (state: FinanceDemoState) => void;
  /** A fixed local identity; each command is independently checked against the frozen roster. */
  actor: unknown;
  /** Test-only deterministic ID injection. Production keeps IDs private to this factory. */
  nextId?: (kind: CatalogLocalIdKind, state: FinanceDemoState) => string;
};

function failure(error: string) {
  return { success: false as const, error };
}

function persistedIds(state: FinanceDemoState): Set<string> {
  return new Set([
    ...state.categories.map((category) => category.id),
    ...state.products.map((product) => product.id),
    ...state.sales.flatMap((sale) => [sale.id, sale.commandId]),
    ...state.payments.flatMap((payment) => [payment.id, payment.commandId]),
  ]);
}

/**
 * IDs are reserved for one mounted provider lifetime. Persisted identifiers are
 * collision checks only, so restored data never changes local suffix arithmetic.
 */
function createDefaultIdAllocator(): (kind: CatalogLocalIdKind, state: FinanceDemoState) => string {
  const nextSuffix: Record<CatalogLocalIdKind, number> = { category: 1, product: 1, command: 1 };
  const reserved = new Set<string>();

  return (kind, state) => {
    const persisted = persistedIds(state);
    while (nextSuffix[kind] <= Number.MAX_SAFE_INTEGER) {
      const candidate = `catalog-${kind}-local-${nextSuffix[kind]}`;
      nextSuffix[kind] += 1;
      if (!persisted.has(candidate) && !reserved.has(candidate)) {
        reserved.add(candidate);
        return candidate;
      }
    }
    throw new Error("No se pudo asignar un identificador local del catálogo.");
  };
}

function centsFromViewAmount(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > FINANCE_CENTS_MAX / 100) return null;
  const scaled = value * 100;
  const cents = Math.round(scaled);
  // Permit binary representations such as 1.1 or 0.29, never a third decimal.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) <= tolerance ? cents : null;
}

function managementState(options: CatalogDemoCallbackFactoryOptions): FinanceDemoState | null {
  if (!canManageCatalog(options.actor)) return null;
  const state = options.getState();
  return isValidFinanceDemoState(state) ? state : null;
}

function allocate(
  nextId: (kind: CatalogLocalIdKind, state: FinanceDemoState) => string,
  kind: CatalogLocalIdKind,
  state: FinanceDemoState,
): string | null {
  try {
    return nextId(kind, state);
  } catch {
    return null;
  }
}

/** Returns only active catalog DTOs after identity and complete-v2-state validation. */
export function projectCatalogDemoManagement(state: FinanceDemoState, actor: unknown): CatalogDemoManagementData | null {
  if (!canManageCatalog(actor) || !isValidFinanceDemoState(state)) return null;
  return {
    categories: state.categories.map((category) => ({ id: category.id, name: category.name })),
    products: state.products
      .filter((product) => product.deletedAt === null)
      .map((product) => ({
        id: product.id,
        code: product.code,
        description: product.description,
        categoryId: product.categoryId,
        salePrice: product.priceCents / 100,
        stock: product.stock,
      })),
    previewCode: state.nextProductCode,
  };
}

/**
 * Bridges the extracted product presentation to the validated, fictional v2
 * catalog state. Failed transitions never commit and IDs remain local.
 */
export function createCatalogDemoCallbackFactory(options: CatalogDemoCallbackFactoryOptions): CatalogDemoCallbacks {
  const nextId = options.nextId ?? createDefaultIdAllocator();

  const createCategory: CreateCategoryCallback = async (rawName) => {
    const state = managementState(options);
    if (!state) return failure(canManageCatalog(options.actor) ? "El catálogo no es válido." : "No autorizado.");
    const id = allocate(nextId, "category", state);
    if (!id) return failure("No se pudo asignar un identificador local del catálogo.");
    const transition = createCatalogCategory(state, { id, actor: options.actor, name: rawName.trim() });
    if (!transition.result.success) return failure(transition.result.error);
    options.commit(transition.state);
    return { success: true, category: { id, name: rawName.trim() } };
  };

  const updateCategory: UpdateCategoryCallback = async (categoryId, rawName) => {
    const state = managementState(options);
    if (!state) return failure(canManageCatalog(options.actor) ? "El catálogo no es válido." : "No autorizado.");
    const id = allocate(nextId, "command", state);
    if (!id) return failure("No se pudo asignar un identificador local del catálogo.");
    const transition = updateCatalogCategory(state, { id, actor: options.actor, categoryId, name: rawName.trim() });
    if (!transition.result.success) return failure(transition.result.error);
    options.commit(transition.state);
    return { success: true };
  };

  const deleteCategory: DeleteCategoryCallback = async (categoryId) => {
    const state = managementState(options);
    if (!state) return failure(canManageCatalog(options.actor) ? "El catálogo no es válido." : "No autorizado.");
    const id = allocate(nextId, "command", state);
    if (!id) return failure("No se pudo asignar un identificador local del catálogo.");
    const transition = deleteCatalogCategory(state, { id, actor: options.actor, categoryId });
    if (!transition.result.success) return failure(transition.result.error);
    options.commit(transition.state);
    return { success: true };
  };

  const createProduct: CreateProductCallback = async (data: ProductInput) => {
    const state = managementState(options);
    if (!state) return failure(canManageCatalog(options.actor) ? "El catálogo no es válido." : "No autorizado.");
    const priceCents = centsFromViewAmount(data.salePrice);
    if (priceCents === null) return failure("El precio no es válido.");
    const id = allocate(nextId, "product", state);
    if (!id) return failure("No se pudo asignar un identificador local del catálogo.");
    const transition = createCatalogProduct(state, {
      id,
      actor: options.actor,
      description: data.description,
      categoryId: data.categoryId,
      priceCents,
      stock: data.stock,
      code: data.code,
    });
    if (!transition.result.success) return failure(transition.result.error);
    options.commit(transition.state);
    return { success: true, code: transition.result.code! };
  };

  const updateProduct: UpdateProductCallback = async (productId, data) => {
    const state = managementState(options);
    if (!state) return failure(canManageCatalog(options.actor) ? "El catálogo no es válido." : "No autorizado.");
    const priceCents = centsFromViewAmount(data.salePrice);
    if (priceCents === null) return failure("El precio no es válido.");
    const id = allocate(nextId, "command", state);
    if (!id) return failure("No se pudo asignar un identificador local del catálogo.");
    const transition = updateCatalogProduct(state, {
      id,
      actor: options.actor,
      productId,
      description: data.description,
      categoryId: data.categoryId,
      priceCents,
      stock: data.stock,
      code: data.code,
    });
    if (!transition.result.success) return failure(transition.result.error);
    options.commit(transition.state);
    return { success: true };
  };

  const deleteProduct: DeleteProductCallback = async (productId) => {
    const state = managementState(options);
    if (!state) return failure(canManageCatalog(options.actor) ? "El catálogo no es válido." : "No autorizado.");
    const id = allocate(nextId, "command", state);
    if (!id) return failure("No se pudo asignar un identificador local del catálogo.");
    const transition = softDeleteCatalogProduct(state, {
      id,
      actor: options.actor,
      productId,
      deletedAt: state.anchor,
    });
    if (!transition.result.success) return failure(transition.result.error);
    options.commit(transition.state);
    return { success: true };
  };

  return { createProduct, updateProduct, deleteProduct, createCategory, updateCategory, deleteCategory };
}
