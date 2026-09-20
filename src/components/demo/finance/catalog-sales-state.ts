// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX, FINANCE_CATALOG_GYM_KIND, POSTGRES_INT_MAX, POSTGRES_INT_MIN, catalogPaymentMethods, financeCatalogSaleActors } from "./catalog-sales-contract.ts";
import type { CatalogSaleActor, CatalogSaleResult, CatalogSaleTransition } from "./catalog-sales-contract";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isFinanceDate } from "./finance-demo-state.ts";
import type { FinanceCategory, FinanceDemoState, FinanceProduct, FinanceSale } from "./finance-demo-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) return false;
  }
  return true;
}

function isPostgresInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= POSTGRES_INT_MIN && value <= POSTGRES_INT_MAX;
}

function isPositivePostgresInt(value: unknown): value is number {
  return isPostgresInt(value) && value >= 1;
}

function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= FINANCE_CENTS_MAX;
}

function isPaymentMethod(value: unknown): boolean {
  return typeof value === "string" && catalogPaymentMethods.includes(value as never);
}

function result(state: FinanceDemoState, value: CatalogSaleResult): CatalogSaleTransition<FinanceDemoState> {
  return { state, result: value };
}

function failure(state: FinanceDemoState, error: string): CatalogSaleTransition<FinanceDemoState> {
  return result(state, { success: false, error });
}

/** Caller-supplied capability claims may only match the closed demo roster. */
export function resolveCatalogSaleActor(value: unknown): CatalogSaleActor | null {
  if (!isRecord(value) || !isId(value.id) || typeof value.role !== "string") return null;
  const actor = Object.values(financeCatalogSaleActors).find((candidate) => candidate.id === value.id);
  if (!actor || value.role !== actor.role) return null;
  if ("canViewRevenue" in value && value.canViewRevenue !== actor.canViewRevenue) return null;
  if ("gymKind" in value && value.gymKind !== FINANCE_CATALOG_GYM_KIND) return null;
  return actor;
}

export function canManageCatalog(value: unknown): boolean {
  const actor = resolveCatalogSaleActor(value);
  return actor?.role === "ADMIN" && actor.canViewRevenue === true;
}

export function canReadCatalog(value: unknown): boolean {
  const actor = resolveCatalogSaleActor(value);
  return actor?.role === "ADMIN" || actor?.role === "TEACHER";
}

export function canRegisterSale(value: unknown): boolean {
  return canReadCatalog(value);
}

function validCatalogGraph(state: unknown): state is FinanceDemoState {
  if (!isRecord(state)
    || !isDenseArray(state.categories)
    || !isDenseArray(state.products)
    || !isDenseArray(state.sales)
    || !isPositivePostgresInt(state.nextProductCode)) return false;
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  for (const category of state.categories) {
    if (!isRecord(category) || !isId(category.id) || typeof category.name !== "string" || !category.name.trim()) return false;
    if (categoryIds.has(category.id) || categoryNames.has(category.name)) return false;
    categoryIds.add(category.id);
    categoryNames.add(category.name);
  }
  const productIds = new Set<string>();
  const activeCodes = new Set<number>();
  for (const product of state.products) {
    if (!isRecord(product)
      || !isId(product.id)
      || !isPositivePostgresInt(product.code)
      || typeof product.description !== "string"
      || !product.description.trim()
      || !isId(product.categoryId)
      || !categoryIds.has(product.categoryId)
      || !isCents(product.priceCents)
      || !isPostgresInt(product.stock)
      || (product.deletedAt !== null && !isFinanceDate(product.deletedAt))) return false;
    if (productIds.has(product.id)) return false;
    productIds.add(product.id);
    if (product.deletedAt === null) {
      if (activeCodes.has(product.code)) return false;
      activeCodes.add(product.code);
    }
  }
  const saleIds = new Set<string>();
  const commandIds = new Set<string>();
  for (const sale of state.sales) {
    if (!isRecord(sale)
      || !isId(sale.id)
      || !isId(sale.commandId)
      || !productIds.has(sale.productId as string)
      || !isPositivePostgresInt(sale.quantity)
      || !isCents(sale.unitAmountCents)
      || !isCents(sale.totalAmountCents)
      || sale.totalAmountCents !== sale.quantity * sale.unitAmountCents
      || !isPaymentMethod(sale.paymentMethod)
      || !isFinanceDate(sale.soldAt)
      || !Object.values(financeCatalogSaleActors).some((actor) => actor.id === sale.recordedById)) return false;
    if (saleIds.has(sale.id) || commandIds.has(sale.commandId)) return false;
    saleIds.add(sale.id);
    commandIds.add(sale.commandId);
  }
  return true;
}

function stateIsUsable(state: FinanceDemoState): boolean {
  return Boolean(state) && validCatalogGraph(state);
}

function category(state: FinanceDemoState, id: unknown): FinanceCategory | null {
  return isId(id) ? state.categories.find((item) => item.id === id) ?? null : null;
}

function activeProduct(state: FinanceDemoState, id: unknown): FinanceProduct | null {
  return isId(id) ? state.products.find((item) => item.id === id && item.deletedAt === null) ?? null : null;
}

export function getCatalogProducts(state: FinanceDemoState, actor: unknown): FinanceProduct[] {
  if (!stateIsUsable(state) || !canReadCatalog(actor)) return [];
  return state.products.filter((product) => product.deletedAt === null).map((product) => ({ ...product }));
}

export function createCatalogCategory(state: FinanceDemoState, rawCommand: unknown): CatalogSaleTransition<FinanceDemoState> {
  if (!stateIsUsable(state)) return failure(state, "El catálogo no es válido.");
  if (!isRecord(rawCommand) || !canManageCatalog(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.id) || typeof rawCommand.name !== "string" || !rawCommand.name.trim()) return failure(state, "La categoría no es válida.");
  const name = rawCommand.name.trim();
  if (state.categories.some((item) => item.id === rawCommand.id || item.name === name)) return failure(state, "La categoría ya existe.");
  return result({ ...state, categories: [...state.categories, { id: rawCommand.id, name }] }, { success: true, id: rawCommand.id });
}

export function updateCatalogCategory(state: FinanceDemoState, rawCommand: unknown): CatalogSaleTransition<FinanceDemoState> {
  if (!stateIsUsable(state)) return failure(state, "El catálogo no es válido.");
  if (!isRecord(rawCommand) || !canManageCatalog(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.id) || !isId(rawCommand.categoryId) || typeof rawCommand.name !== "string" || !rawCommand.name.trim()) return failure(state, "La categoría no es válida.");
  const name = rawCommand.name.trim();
  if (!category(state, rawCommand.categoryId)) return failure(state, "Categoría no encontrada.");
  if (state.categories.some((item) => item.id !== rawCommand.categoryId && item.name === name)) return failure(state, "La categoría ya existe.");
  return result({ ...state, categories: state.categories.map((item) => item.id === rawCommand.categoryId ? { ...item, name } : item) }, { success: true, id: rawCommand.categoryId });
}

export function deleteCatalogCategory(state: FinanceDemoState, rawCommand: unknown): CatalogSaleTransition<FinanceDemoState> {
  if (!stateIsUsable(state)) return failure(state, "El catálogo no es válido.");
  if (!isRecord(rawCommand) || !canManageCatalog(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.id) || !isId(rawCommand.categoryId)) return failure(state, "La categoría no es válida.");
  if (!category(state, rawCommand.categoryId)) return failure(state, "Categoría no encontrada.");
  if (state.products.some((product) => product.categoryId === rawCommand.categoryId)) return failure(state, "No se puede eliminar una categoría con productos asociados.");
  return result({ ...state, categories: state.categories.filter((item) => item.id !== rawCommand.categoryId) }, { success: true, id: rawCommand.categoryId });
}

function validProductInput(command: Record<string, unknown>): command is Record<string, unknown> & {
  id: string; description: string; categoryId: string; priceCents: number; stock: number;
} {
  return isId(command.id)
    && typeof command.description === "string"
    && Boolean(command.description.trim())
    && isId(command.categoryId)
    && isCents(command.priceCents)
    && isPostgresInt(command.stock);
}

function recoverAutomaticProductCode(state: FinanceDemoState): { code: number; nextProductCode: number } | null {
  const currentCode = state.nextProductCode;
  const activeCodes = state.products.filter((product) => product.deletedAt === null).map((product) => product.code);
  if (!activeCodes.includes(currentCode)) {
    return currentCode < POSTGRES_INT_MAX ? { code: currentCode, nextProductCode: currentCode + 1 } : null;
  }

  // Mirrors product.ts: after an active-code collision, resync from MAX(code) and retry.
  const maximumActiveCode = Math.max(...activeCodes);
  if (maximumActiveCode >= POSTGRES_INT_MAX - 1) return null;
  const recoveredCode = maximumActiveCode + 1;
  return { code: recoveredCode, nextProductCode: recoveredCode + 1 };
}

export function createCatalogProduct(state: FinanceDemoState, rawCommand: unknown): CatalogSaleTransition<FinanceDemoState> {
  if (!stateIsUsable(state)) return failure(state, "El catálogo no es válido.");
  if (!isRecord(rawCommand) || !canManageCatalog(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!validProductInput(rawCommand)) return failure(state, "El producto no es válido.");
  if (!category(state, rawCommand.categoryId)) return failure(state, "Categoría no encontrada.");
  if (state.products.some((product) => product.id === rawCommand.id)) return failure(state, "Identificador de producto inválido.");

  const automatic = rawCommand.code === undefined ? recoverAutomaticProductCode(state) : null;
  if (rawCommand.code === undefined && !automatic) return failure(state, "El contador de códigos no admite otro producto.");
  const code = automatic?.code ?? rawCommand.code;
  if (!isPositivePostgresInt(code)) return failure(state, "El código debe ser un entero positivo.");
  if (state.products.some((product) => product.deletedAt === null && product.code === code)) return failure(state, "Ya existe un producto con ese código.");

  const product: FinanceProduct = {
    id: rawCommand.id,
    code,
    description: rawCommand.description.trim(),
    categoryId: rawCommand.categoryId,
    priceCents: rawCommand.priceCents,
    stock: rawCommand.stock,
    deletedAt: null,
  };
  return result({
    ...state,
    products: [...state.products, product],
    nextProductCode: automatic?.nextProductCode ?? state.nextProductCode,
  }, { success: true, id: product.id, code });
}

export function updateCatalogProduct(state: FinanceDemoState, rawCommand: unknown): CatalogSaleTransition<FinanceDemoState> {
  if (!stateIsUsable(state)) return failure(state, "El catálogo no es válido.");
  if (!isRecord(rawCommand) || !canManageCatalog(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.id) || !isId(rawCommand.productId)) return failure(state, "El producto no es válido.");
  const product = activeProduct(state, rawCommand.productId);
  if (!product) return failure(state, "Producto no encontrado.");
  const changes: Partial<FinanceProduct> = {};
  if ("description" in rawCommand) {
    if (typeof rawCommand.description !== "string" || !rawCommand.description.trim()) return failure(state, "La descripción es obligatoria.");
    changes.description = rawCommand.description.trim();
  }
  if ("categoryId" in rawCommand) {
    if (!category(state, rawCommand.categoryId)) return failure(state, "Categoría no encontrada.");
    changes.categoryId = rawCommand.categoryId as string;
  }
  if ("priceCents" in rawCommand) {
    if (!isCents(rawCommand.priceCents)) return failure(state, "El precio no es válido.");
    changes.priceCents = rawCommand.priceCents;
  }
  if ("stock" in rawCommand) {
    if (!isPostgresInt(rawCommand.stock)) return failure(state, "El stock debe ser un entero.");
    changes.stock = rawCommand.stock;
  }
  if ("code" in rawCommand) {
    if (!isPositivePostgresInt(rawCommand.code)) return failure(state, "El código debe ser un entero positivo.");
    if (state.products.some((item) => item.id !== product.id && item.deletedAt === null && item.code === rawCommand.code)) return failure(state, "Ya existe un producto con ese código.");
    changes.code = rawCommand.code;
  }
  if (Object.keys(changes).length === 0) return failure(state, "No hay cambios para guardar.");
  return result({ ...state, products: state.products.map((item) => item.id === product.id ? { ...item, ...changes } : item) }, { success: true, id: product.id });
}

export function softDeleteCatalogProduct(state: FinanceDemoState, rawCommand: unknown): CatalogSaleTransition<FinanceDemoState> {
  if (!stateIsUsable(state)) return failure(state, "El catálogo no es válido.");
  if (!isRecord(rawCommand) || !canManageCatalog(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.id) || !isId(rawCommand.productId) || !isFinanceDate(rawCommand.deletedAt)) return failure(state, "El producto no es válido.");
  const product = activeProduct(state, rawCommand.productId);
  if (!product) return failure(state, "Producto no encontrado.");
  return result({ ...state, products: state.products.map((item) => item.id === product.id ? { ...item, deletedAt: rawCommand.deletedAt as string } : item) }, { success: true, id: product.id });
}

export function registerCatalogSale(state: FinanceDemoState, rawCommand: unknown, today: string = state.anchor): CatalogSaleTransition<FinanceDemoState> {
  if (!stateIsUsable(state)) return failure(state, "El catálogo no es válido.");
  if (!isRecord(rawCommand) || !canRegisterSale(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.id) || !isId(rawCommand.commandId) || !isId(rawCommand.productId)
    || !isPositivePostgresInt(rawCommand.quantity) || !isCents(rawCommand.unitAmountCents)
    || !isPaymentMethod(rawCommand.paymentMethod) || !isFinanceDate(rawCommand.soldAt) || !isFinanceDate(today)) return failure(state, "La venta no es válida.");
  if (rawCommand.soldAt > today) return failure(state, "La fecha de la venta no puede ser futura.");
  const actor = resolveCatalogSaleActor(rawCommand.actor);
  if (!actor) return failure(state, "No autorizado.");
  const existing = state.sales.find((sale) => sale.commandId === rawCommand.commandId);
  if (existing) {
    const matches = existing.id === rawCommand.id
      && existing.productId === rawCommand.productId
      && existing.quantity === rawCommand.quantity
      && existing.unitAmountCents === rawCommand.unitAmountCents
      && existing.paymentMethod === rawCommand.paymentMethod
      && existing.soldAt === rawCommand.soldAt
      && existing.recordedById === actor.id;
    return matches ? result(state, { success: true, id: existing.id, idempotent: true }) : failure(state, "El identificador del comando ya fue usado con otra venta.");
  }
  const product = activeProduct(state, rawCommand.productId);
  if (!product) return failure(state, "Producto no encontrado.");
  if (state.sales.some((sale) => sale.id === rawCommand.id)) return failure(state, "Identificador de venta inválido.");
  const totalAmountCents = rawCommand.quantity * rawCommand.unitAmountCents;
  if (!isCents(totalAmountCents)) return failure(state, "El importe total no es válido.");
  const nextStock = product.stock - rawCommand.quantity;
  if (!isPostgresInt(nextStock)) return failure(state, "El stock no admite esa venta.");
  const sale: FinanceSale = {
    id: rawCommand.id,
    commandId: rawCommand.commandId,
    productId: product.id,
    quantity: rawCommand.quantity,
    unitAmountCents: rawCommand.unitAmountCents,
    totalAmountCents,
    paymentMethod: rawCommand.paymentMethod as FinanceSale["paymentMethod"],
    soldAt: rawCommand.soldAt,
    recordedById: actor.id,
  };
  return result({ ...state, sales: [...state.sales, sale], products: state.products.map((item) => item.id === product.id ? { ...item, stock: nextStock } : item) }, {
    success: true,
    id: sale.id,
    idempotent: false,
    stockWarning: nextStock <= 0,
  });
}
