import type {
  CreateCategoryCallback,
  CreateCategoryResult,
  CreateProductCallback,
  CreateProductResult,
  DeleteCategoryCallback,
  DeleteProductCallback,
  ProductCategoryOption,
  ProductInput,
  ProductRow,
  ProductResult,
  UpdateCategoryCallback,
  UpdateProductCallback,
} from "@/components/products/product-view-contracts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createCatalogCategory, createCatalogProduct, deleteCatalogCategory, softDeleteCatalogProduct, updateCatalogCategory, updateCatalogProduct } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesOwnedFinanceState, canManageFinanceCatalog, isGymFinanceActor, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type { GymFinanceDemoState } from "./finance-demo-types";

type GymCatalogIdKind = "category" | "product" | "command";
type PendingOperation = { key: string; generation: number; promise: Promise<unknown> };
type CapturedProductInput = Readonly<{
  description: unknown;
  categoryId: unknown;
  salePrice: unknown;
  stock: unknown;
  code: unknown;
  validShape: boolean;
}>;

export type GymCatalogDemoManagementData = {
  categories: ProductCategoryOption[];
  products: ProductRow[];
  previewCode: number;
};

/** The projection never turns a nullable data value into an authorization signal. */
export type GymCatalogDemoManagementProjection =
  | Readonly<{ success: true } & GymCatalogDemoManagementData>
  | Readonly<{ success: false; error: string }>;

export type GymCatalogDemoCallbacks = {
  createProduct: CreateProductCallback;
  updateProduct: UpdateProductCallback;
  deleteProduct: DeleteProductCallback;
  createCategory: CreateCategoryCallback;
  updateCategory: UpdateCategoryCallback;
  deleteCategory: DeleteCategoryCallback;
  /** Invalidates queued work when a future provider resets or unmounts. */
  cancelPending: () => void;
};

export type GymCatalogDemoCallbackFactoryOptions = {
  getState: () => GymFinanceDemoState;
  commit: (state: GymFinanceDemoState) => void;
  /** Opaque canonical directory token; profile-shaped values cannot authorize commands. */
  gymActorToken: unknown;
  /** Test-only deterministic source. Values remain private lifetime reservations. */
  nextId?: (kind: GymCatalogIdKind, state: GymFinanceDemoState) => string;
};

const MAX_ID_ATTEMPTS = 64;
const NOT_AUTHORIZED = "No autorizado.";
const INVALID_STATE = "El estado financiero no es válido.";
const BUSY = "Hay una operación de catálogo en curso. Esperá un momento.";
const CANCELLED = "La operación de catálogo fue restablecida antes de guardarse.";
const ID_FAILURE = "No se pudo asignar un identificador local del catálogo.";

function failure(error: string) {
  return { success: false as const, error };
}

type OperationFailure = ReturnType<typeof failure>;

function isOperationFailure(value: GymFinanceDemoState | OperationFailure): value is OperationFailure {
  return "success" in value;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function centsFromViewAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > FINANCE_CENTS_MAX / 100) return null;
  const scaled = value * 100;
  const cents = Math.round(scaled);
  // Preserve the BOX boundary: binary 1.1/0.29 are valid; thirds are not rounded in.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) <= tolerance ? cents : null;
}

function capturedText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function keyPart(value: unknown): string {
  if (typeof value === "string") return `s:${value.length}:${value}`;
  if (typeof value === "number") return Number.isFinite(value) ? `n:${value}` : "n:invalid";
  if (value === undefined) return "undefined";
  return `other:${typeof value}`;
}

function capturesExactly(keys: readonly (string | symbol)[], descriptors: object): boolean {
  const capturedKeys = Reflect.ownKeys(descriptors);
  return keys.length === capturedKeys.length && keys.every((key) => capturedKeys.includes(key));
}

/** Captures every input field exactly once without invoking a caller getter. */
function captureProductInput(value: unknown): CapturedProductInput {
  const invalid: CapturedProductInput = { description: undefined, categoryId: undefined, salePrice: undefined, stock: undefined, code: undefined, validShape: false };
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return invalid;
    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    // Descriptor-map keys are private captured data. Do not enumerate the source again.
    if (!capturesExactly(keys, descriptors) || keys.some((key) => typeof key !== "string")) return invalid;
    const stringKeys = keys as string[];
    const allowed = ["description", "categoryId", "salePrice", "stock", "code"];
    if (stringKeys.some((key) => !allowed.includes(key)) || ![4, 5].includes(stringKeys.length)) return invalid;
    if (!["description", "categoryId", "salePrice", "stock"].every((key) => stringKeys.includes(key))) return invalid;
    if (!stringKeys.every((key) => {
      const descriptor = descriptors[key];
      return descriptor && "value" in descriptor && descriptor.enumerable;
    })) return invalid;
    return {
      description: descriptors.description.value,
      categoryId: descriptors.categoryId.value,
      salePrice: descriptors.salePrice.value,
      stock: descriptors.stock.value,
      code: descriptors.code && "value" in descriptors.code ? descriptors.code.value : undefined,
      validShape: true,
    };
  } catch {
    return invalid;
  }
}

function productKey(input: CapturedProductInput): string {
  return [keyPart(input.description), keyPart(input.categoryId), keyPart(input.salePrice), keyPart(input.stock), keyPart(input.code), input.validShape ? "shape:1" : "shape:0"].join("|");
}

function hasValidProductShape(input: CapturedProductInput): boolean {
  return input.validShape
    && typeof input.description === "string"
    && typeof input.categoryId === "string"
    && typeof input.stock === "number"
    && (input.code === undefined || typeof input.code === "number");
}

function occupiedIds(state: GymFinanceDemoState): Set<string> {
  return new Set([
    ...state.categories.map((entry) => entry.id),
    ...state.products.map((entry) => entry.id),
    ...state.sales.flatMap((entry) => [entry.id, entry.commandId]),
    ...state.payments.flatMap((entry) => [entry.id, entry.commandId]),
    ...state.expenses.map((entry) => entry.id),
  ]);
}

function createDefaultIdSource(): (kind: GymCatalogIdKind) => string {
  const suffix: Record<GymCatalogIdKind, number> = { category: 1, product: 1, command: 1 };
  return (kind) => `gym-catalog-${kind}-local-${suffix[kind]++}`;
}

function allocateId(
  state: GymFinanceDemoState,
  kind: GymCatalogIdKind,
  source: (kind: GymCatalogIdKind, state: GymFinanceDemoState) => string,
  reserved: Set<string>,
): string | null {
  const occupied = occupiedIds(state);
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    // Trusted dependency errors deliberately propagate and the pending lock is released by finally.
    const candidate = source(kind, state);
    if (isId(candidate) && !occupied.has(candidate) && !reserved.has(candidate)) {
      reserved.add(candidate);
      return candidate;
    }
  }
  return null;
}

function managementActor(token: unknown) {
  // Resolve the opaque directory identity first. This prevents a BOX-shaped value
  // from reaching the generic finance resolver as a fallback capability.
  const canonical = resolveGymDemoActor(token);
  if (!canonical || canonical.role !== "ADMIN") return null;
  const actor = resolveFinanceDemoActor(token);
  return actor && isGymFinanceActor(actor) && canManageFinanceCatalog(actor) ? actor : null;
}

/**
 * One authorization gate, then one validator-owned capture. A valid empty
 * catalog is therefore distinguishable from an invalid ledger or denial.
 */
export function projectGymCatalogDemoManagement(state: unknown, gymActorToken: unknown): GymCatalogDemoManagementProjection {
  const actor = managementActor(gymActorToken);
  if (!actor) return Object.freeze(failure(NOT_AUTHORIZED));
  const captured = getValidatedGymFinanceDemoState(state);
  if (!captured || !actorMatchesOwnedFinanceState(actor, captured)) return Object.freeze(failure(INVALID_STATE));
  return Object.freeze({
    success: true as const,
    categories: captured.categories.map((category) => ({ id: category.id, name: category.name })),
    products: captured.products
      .filter((product) => product.deletedAt === null)
      .map((product) => ({
        id: product.id,
        code: product.code,
        description: product.description,
        categoryId: product.categoryId,
        salePrice: product.priceCents / 100,
        stock: product.stock,
      })),
    previewCode: captured.nextProductCode,
  });
}

/**
 * Unmounted GYM catalog bridge. The queue is intentionally factory-wide: the
 * catalog reducer always receives one fresh, validator-owned state snapshot.
 */
export function createGymCatalogDemoCallbackFactory(
  options: GymCatalogDemoCallbackFactoryOptions,
): GymCatalogDemoCallbacks {
  const actorToken = options.gymActorToken;
  const actor = managementActor(actorToken);
  const defaultId = createDefaultIdSource();
  const source = options.nextId ?? ((kind: GymCatalogIdKind) => defaultId(kind));
  const reservedIds = new Set<string>();
  let generation = 0;
  let pending: PendingOperation | null = null;

  function current(operationGeneration: number): boolean {
    return operationGeneration === generation;
  }

  function freshState(operationGeneration: number): GymFinanceDemoState | OperationFailure {
    const supplied = options.getState();
    if (!current(operationGeneration)) return failure(CANCELLED);
    const state = getValidatedGymFinanceDemoState(supplied);
    if (!current(operationGeneration)) return failure(CANCELLED);
    if (!state || !actor || !actorMatchesOwnedFinanceState(actor, state)) return failure(INVALID_STATE);
    return state;
  }

  function run<T>(key: string, execute: (operationGeneration: number) => T): Promise<T> {
    if (pending) {
      return pending.key === key && pending.generation === generation
        ? pending.promise as Promise<T>
        : Promise.resolve(failure(BUSY) as T);
    }
    const operationGeneration = generation;
    const entry = {} as PendingOperation;
    const promise = Promise.resolve().then(() => current(operationGeneration)
      ? execute(operationGeneration)
      : failure(CANCELLED) as T);
    entry.key = key;
    entry.generation = operationGeneration;
    entry.promise = promise;
    pending = entry;
    void promise.then(
      () => { if (pending === entry) pending = null; },
      () => { if (pending === entry) pending = null; },
    );
    return promise;
  }

  function cancellationOr<T = never>(operationGeneration: number): OperationFailure | (T & never) | null {
    return current(operationGeneration) ? null : failure(CANCELLED);
  }

  const createCategory: CreateCategoryCallback = (rawName) => {
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const name = capturedText(rawName);
    const key = `create-category|${keyPart(name)}`;
    return run<CreateCategoryResult>(key, (operationGeneration) => {
      const state = freshState(operationGeneration);
      if (isOperationFailure(state)) return state;
      if (name === null || !name.trim()) return failure("La categoría no es válida.");
      const id = allocateId(state, "category", source, reservedIds);
      const cancelled = cancellationOr<typeof state>(operationGeneration);
      if (cancelled) return cancelled;
      if (!id) return failure(ID_FAILURE);
      const transition = createCatalogCategory(state, { id, actor: actorToken, name: name.trim() });
      const late = cancellationOr<typeof transition.result>(operationGeneration);
      if (late) return late;
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true as const, category: { id, name: name.trim() } };
    });
  };

  const updateCategory: UpdateCategoryCallback = (rawCategoryId, rawName) => {
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const categoryId = capturedText(rawCategoryId);
    const name = capturedText(rawName);
    const key = `update-category|${keyPart(categoryId)}|${keyPart(name)}`;
    return run<ProductResult>(key, (operationGeneration) => {
      const state = freshState(operationGeneration);
      if (isOperationFailure(state)) return state;
      if (!isId(categoryId) || name === null || !name.trim()) return failure("La categoría no es válida.");
      const id = allocateId(state, "command", source, reservedIds);
      const cancelled = cancellationOr<typeof state>(operationGeneration);
      if (cancelled) return cancelled;
      if (!id) return failure(ID_FAILURE);
      const transition = updateCatalogCategory(state, { id, actor: actorToken, categoryId, name: name.trim() });
      const late = cancellationOr<typeof transition.result>(operationGeneration);
      if (late) return late;
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true as const };
    });
  };

  const deleteCategory: DeleteCategoryCallback = (rawCategoryId) => {
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const categoryId = capturedText(rawCategoryId);
    const key = `delete-category|${keyPart(categoryId)}`;
    return run<ProductResult>(key, (operationGeneration) => {
      const state = freshState(operationGeneration);
      if (isOperationFailure(state)) return state;
      if (!isId(categoryId)) return failure("La categoría no es válida.");
      const id = allocateId(state, "command", source, reservedIds);
      const cancelled = cancellationOr<typeof state>(operationGeneration);
      if (cancelled) return cancelled;
      if (!id) return failure(ID_FAILURE);
      const transition = deleteCatalogCategory(state, { id, actor: actorToken, categoryId });
      const late = cancellationOr<typeof transition.result>(operationGeneration);
      if (late) return late;
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true as const };
    });
  };

  const createProduct: CreateProductCallback = (data: ProductInput) => {
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const input = captureProductInput(data);
    if (!input.validShape) return Promise.resolve(failure("El precio no es válido."));
    const key = `create-product|${productKey(input)}`;
    return run<CreateProductResult>(key, (operationGeneration) => {
      const state = freshState(operationGeneration);
      if (isOperationFailure(state)) return state;
      const priceCents = centsFromViewAmount(input.salePrice);
      if (priceCents === null) return failure("El precio no es válido.");
      if (!hasValidProductShape(input)) return failure("El producto no es válido.");
      const id = allocateId(state, "product", source, reservedIds);
      const cancelled = cancellationOr<typeof state>(operationGeneration);
      if (cancelled) return cancelled;
      if (!id) return failure(ID_FAILURE);
      const transition = createCatalogProduct(state, {
        id,
        actor: actorToken,
        description: input.description,
        categoryId: input.categoryId,
        priceCents,
        stock: input.stock,
        code: input.code,
      });
      const late = cancellationOr<typeof transition.result>(operationGeneration);
      if (late) return late;
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true as const, code: transition.result.code! };
    });
  };

  const updateProduct: UpdateProductCallback = (rawProductId, data) => {
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const productId = capturedText(rawProductId);
    const input = captureProductInput(data);
    if (!input.validShape) return Promise.resolve(failure("El precio no es válido."));
    const key = `update-product|${keyPart(productId)}|${productKey(input)}`;
    return run<ProductResult>(key, (operationGeneration) => {
      const state = freshState(operationGeneration);
      if (isOperationFailure(state)) return state;
      const priceCents = centsFromViewAmount(input.salePrice);
      if (priceCents === null) return failure("El precio no es válido.");
      if (!isId(productId) || !hasValidProductShape(input)) return failure("El producto no es válido.");
      const id = allocateId(state, "command", source, reservedIds);
      const cancelled = cancellationOr<typeof state>(operationGeneration);
      if (cancelled) return cancelled;
      if (!id) return failure(ID_FAILURE);
      const transition = updateCatalogProduct(state, {
        id,
        actor: actorToken,
        productId,
        description: input.description,
        categoryId: input.categoryId,
        priceCents,
        stock: input.stock,
        code: input.code,
      });
      const late = cancellationOr<typeof transition.result>(operationGeneration);
      if (late) return late;
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true as const };
    });
  };

  const deleteProduct: DeleteProductCallback = (rawProductId) => {
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const productId = capturedText(rawProductId);
    const key = `delete-product|${keyPart(productId)}`;
    return run<ProductResult>(key, (operationGeneration) => {
      const state = freshState(operationGeneration);
      if (isOperationFailure(state)) return state;
      if (!isId(productId)) return failure("El producto no es válido.");
      const id = allocateId(state, "command", source, reservedIds);
      const cancelled = cancellationOr<typeof state>(operationGeneration);
      if (cancelled) return cancelled;
      if (!id) return failure(ID_FAILURE);
      const transition = softDeleteCatalogProduct(state, { id, actor: actorToken, productId, deletedAt: state.anchor });
      const late = cancellationOr<typeof transition.result>(operationGeneration);
      if (late) return late;
      if (!transition.result.success) return failure(transition.result.error);
      options.commit(transition.state);
      return { success: true as const };
    });
  };

  return {
    createProduct,
    updateProduct,
    deleteProduct,
    createCategory,
    updateCategory,
    deleteCategory,
    cancelPending() {
      generation += 1;
      pending = null;
    },
  };
}
