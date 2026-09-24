import type {
  ProductCatalogItem,
  SaleDatePolicy,
  SaleRegistrationCallback,
  SaleRegistrationResult,
} from "@/components/sales/sale-view-contracts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { registerCatalogSale } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesOwnedFinanceState, canReadFinanceCatalog, isGymFinanceActor, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type { GymFinanceDemoState } from "./finance-demo-types";

type GymSaleIdKind = "sale" | "command";
type PendingSale = { signature: string; generation: number; promise: Promise<SaleRegistrationResult> };
type CapturedSaleOptions = Readonly<{ soldAt: unknown; paymentMethod: unknown; validShape: boolean }>;

export type GymSaleDemoCallbackFactoryOptions = {
  getState: () => GymFinanceDemoState;
  commit: (state: GymFinanceDemoState) => void;
  /** Opaque canonical directory token; copied profiles and BOX actors cannot sell here. */
  gymActorToken: unknown;
  /** Trusted provider clock used only when the queued reducer command executes. */
  trustedSaleDatePolicy: SaleDatePolicy;
  /** Test-only deterministic identifier source; all successful allocations stay private reservations. */
  nextId?: (kind: GymSaleIdKind, state: GymFinanceDemoState) => string;
};

export type GymSaleDemoCallback = SaleRegistrationCallback & {
  /** Invalidates a scheduled sale when the future provider resets or unmounts. */
  cancelPendingSale: () => void;
  /** Provider compatibility alias; it is deliberately the same cancellation operation. */
  cancelPending: () => void;
};

export type GymSaleDemoCatalogProjection =
  | Readonly<{ success: true; products: ProductCatalogItem[] }>
  | Readonly<{ success: false; error: string }>;

const MAX_ID_ATTEMPTS = 64;
const NOT_AUTHORIZED = "No autorizado.";
const INVALID_STATE = "El estado financiero no es válido.";
const BUSY = "Hay una venta en curso. Esperá un momento.";
const CANCELLED = "La venta fue restablecida antes de registrarse.";
const ID_FAILURE = "No se pudo asignar un identificador local de venta.";

function failure(error: string): SaleRegistrationResult {
  return { success: false, error };
}

function projectionFailure(error: string): GymSaleDemoCatalogProjection {
  return Object.freeze({ success: false as const, error });
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function centsFromViewAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > FINANCE_CENTS_MAX / 100) return null;
  const scaled = value * 100;
  const cents = Math.round(scaled);
  // Keep the BOX display boundary: binary 1.1/0.29 pass, thirds do not round in.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) <= tolerance ? cents : null;
}

function valuePart(value: unknown): string {
  if (typeof value === "string") return `s:${value.length}:${value}`;
  if (typeof value === "number") return Number.isFinite(value) ? `n:${value}` : "n:invalid";
  if (typeof value === "boolean") return value ? "b:1" : "b:0";
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return `other:${typeof value}`;
}

function sameKeys(left: readonly (string | symbol)[], right: readonly (string | symbol)[]): boolean {
  return left.length === right.length && left.every((key) => right.includes(key));
}

/**
 * One source key enumeration followed by one descriptor capture. Values are
 * subsequently read only from that private descriptor map, never from caller input.
 */
function captureSaleOptions(value: unknown): CapturedSaleOptions {
  const invalid: CapturedSaleOptions = { soldAt: undefined, paymentMethod: undefined, validShape: false };
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return invalid;
    const initialKeys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const capturedKeys = Reflect.ownKeys(descriptors);
    if (!sameKeys(initialKeys, capturedKeys) || initialKeys.some((key) => typeof key !== "string")) return invalid;
    const keys = initialKeys as string[];
    if (keys.length !== 2 || !keys.includes("soldAtStr") || !keys.includes("paymentMethod")) return invalid;
    if (!keys.every((key) => {
      const descriptor = descriptors[key];
      return descriptor && "value" in descriptor && descriptor.enumerable;
    })) return invalid;
    return {
      soldAt: descriptors.soldAtStr.value,
      paymentMethod: descriptors.paymentMethod.value,
      validShape: true,
    };
  } catch {
    return invalid;
  }
}

function requestSignature(actorId: string, productId: unknown, quantity: unknown, unitAmount: unknown, input: CapturedSaleOptions): string {
  return [
    `actor:${actorId.length}:${actorId}`,
    valuePart(productId),
    valuePart(quantity),
    valuePart(unitAmount),
    valuePart(input.soldAt),
    valuePart(input.paymentMethod),
    input.validShape ? "shape:1" : "shape:0",
  ].join("|");
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

function createDefaultIdSource(): (kind: GymSaleIdKind) => string {
  const suffix: Record<GymSaleIdKind, number> = { sale: 1, command: 1 };
  return (kind) => `gym-sale-${kind}-local-${suffix[kind]++}`;
}

/** Attempts bound source calls, not identifier length; accepted IDs never become reusable. */
function allocateId(
  state: GymFinanceDemoState,
  kind: GymSaleIdKind,
  source: (kind: GymSaleIdKind, state: GymFinanceDemoState) => string,
  reserved: Set<string>,
): string | null {
  const occupied = occupiedIds(state);
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    // Trusted dependency exceptions propagate; the queue cleanup still releases its slot.
    const candidate = source(kind, state);
    if (isId(candidate) && !occupied.has(candidate) && !reserved.has(candidate)) {
      reserved.add(candidate);
      return candidate;
    }
  }
  return null;
}

function saleActor(token: unknown) {
  // Resolve the opaque GYM directory identity before the generic finance policy.
  // This prevents a BOX roster-shaped value from becoming a GYM capability.
  const canonical = resolveGymDemoActor(token);
  if (!canonical || (canonical.role !== "ADMIN" && canonical.role !== "TEACHER")) return null;
  const actor = resolveFinanceDemoActor(token);
  return actor && isGymFinanceActor(actor) && canReadFinanceCatalog(actor) ? actor : null;
}

/**
 * Safe, detached sale-form catalog projection. Staff authorization happens
 * before the validator captures any state, so denial cannot inspect a ledger.
 */
export function projectGymSaleDemoCatalog(state: unknown, gymActorToken: unknown): GymSaleDemoCatalogProjection {
  const actor = saleActor(gymActorToken);
  if (!actor) return projectionFailure(NOT_AUTHORIZED);
  const captured = getValidatedGymFinanceDemoState(state);
  if (!captured || !actorMatchesOwnedFinanceState(actor, captured)) return projectionFailure(INVALID_STATE);
  const categoryNames = new Map(captured.categories.map((category) => [category.id, category.name]));
  const products = captured.products.flatMap((product) => {
    if (product.deletedAt !== null) return [];
    const categoryName = categoryNames.get(product.categoryId);
    return categoryName === undefined ? [] : [{
      id: product.id,
      code: product.code,
      description: product.description,
      salePrice: product.priceCents / 100,
      stock: product.stock,
      categoryName,
    }];
  });
  return Object.freeze({ success: true as const, products });
}

/**
 * Unmounted GYM sale bridge. One factory-wide queue reads one fresh, validator-owned
 * graph per execution; the shared reducer remains the business-rule authority.
 */
export function createGymSaleDemoCallbackFactory(options: GymSaleDemoCallbackFactoryOptions): GymSaleDemoCallback {
  const actorToken = options.gymActorToken;
  const actor = saleActor(actorToken);
  const defaultId = createDefaultIdSource();
  const source = options.nextId ?? ((kind: GymSaleIdKind) => defaultId(kind));
  const reservedIds = new Set<string>();
  let generation = 0;
  let pending: PendingSale | null = null;

  function current(operationGeneration: number): boolean {
    return operationGeneration === generation;
  }

  function cancelCurrentWork() {
    generation += 1;
    pending = null;
  }

  function execute(
    productId: unknown,
    quantity: unknown,
    unitAmount: unknown,
    input: CapturedSaleOptions,
    operationGeneration: number,
  ): SaleRegistrationResult {
    if (!current(operationGeneration)) return failure(CANCELLED);
    const supplied = options.getState();
    if (!current(operationGeneration)) return failure(CANCELLED);
    const state = getValidatedGymFinanceDemoState(supplied);
    if (!current(operationGeneration)) return failure(CANCELLED);
    if (!state || !actor || !actorMatchesOwnedFinanceState(actor, state)) return failure(INVALID_STATE);

    if (!input.validShape) return failure("La venta no es válida.");
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 2_147_483_647) return failure("La cantidad no es válida.");
    const unitAmountCents = centsFromViewAmount(unitAmount);
    if (unitAmountCents === null) return failure("El importe unitario no es válido.");

    const id = allocateId(state, "sale", source, reservedIds);
    // The accepted value is reserved before any later trusted dependency can reenter.
    if (!current(operationGeneration)) return failure(CANCELLED);
    if (!id) return failure(ID_FAILURE);
    const commandId = allocateId(state, "command", source, reservedIds);
    if (!current(operationGeneration)) return failure(CANCELLED);
    if (!commandId) return failure(ID_FAILURE);
    const today = options.trustedSaleDatePolicy.today();
    if (!current(operationGeneration)) return failure(CANCELLED);

    const transition = registerCatalogSale(state, {
      id,
      commandId,
      actor: actorToken,
      productId,
      quantity,
      unitAmountCents,
      soldAt: input.soldAt,
      paymentMethod: input.paymentMethod,
    }, today);
    if (!current(operationGeneration)) return failure(CANCELLED);
    if (!transition.result.success) return failure(transition.result.error);
    if (!transition.result.idempotent) {
      // A commit may reset the provider synchronously; an already written commit cannot roll back.
      options.commit(transition.state);
    }
    return { success: true };
  }

  const callback: GymSaleDemoCallback = (productId, quantity, unitAmount, registrationOptions) => {
    // Authorization is the only pre-capture operation: no caller input, state, IDs, or clock on denial.
    if (!actor) return Promise.resolve(failure(NOT_AUTHORIZED));
    const input = captureSaleOptions(registrationOptions);
    if (!input.validShape) return Promise.resolve(failure("La venta no es válida."));
    const signature = requestSignature(actor.id, productId, quantity, unitAmount, input);
    if (pending) {
      return pending.signature === signature && pending.generation === generation
        ? pending.promise
        : Promise.resolve(failure(BUSY));
    }

    const operationGeneration = generation;
    const entry = {} as PendingSale;
    const promise = Promise.resolve().then(() => execute(productId, quantity, unitAmount, input, operationGeneration));
    entry.signature = signature;
    entry.generation = operationGeneration;
    entry.promise = promise;
    pending = entry;
    void promise.then(
      () => { if (pending === entry) pending = null; },
      () => { if (pending === entry) pending = null; },
    );
    return promise;
  };

  callback.cancelPendingSale = cancelCurrentWork;
  callback.cancelPending = cancelCurrentWork;
  return callback;
}

/** Kept as an explicit finance namespace alias for consumers that use the payment naming scheme. */
export const createGymFinanceSaleCallbackFactory = createGymSaleDemoCallbackFactory;
