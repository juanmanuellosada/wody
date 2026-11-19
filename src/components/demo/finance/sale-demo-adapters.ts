import type {
  ProductCatalogItem,
  SaleDatePolicy,
  SaleRegistrationCallback,
  SaleRegistrationOptions,
  SaleRegistrationResult,
} from "@/components/sales/sale-view-contracts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX } from "./catalog-sales-contract.ts";
import {
  canRegisterSale,
  getCatalogProducts,
  registerCatalogSale,
  // @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
} from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidFinanceDemoState } from "./finance-demo-storage.ts";
import type { FinanceDemoState } from "./finance-demo-types";

type SaleLocalIdKind = "sale" | "command";

type PendingSale = {
  signature: string;
  promise: Promise<SaleRegistrationResult>;
};

export type SaleDemoCallback = SaleRegistrationCallback & {
  /** Invalidates a scheduled local command before a finance reset replaces its state. */
  cancelPendingSale: () => void;
};

export type SaleDemoCallbackFactoryOptions = {
  getState: () => FinanceDemoState;
  commit: (state: FinanceDemoState) => void;
  /** Fixed by the provider; callers cannot provide or elevate a sale identity. */
  fixedActor: unknown;
  /** The same trusted local-calendar policy passed to the presentation. */
  datePolicy: SaleDatePolicy;
  /** Test-only deterministic ID injection. Production keeps reservations private to this factory. */
  nextId?: (kind: SaleLocalIdKind, state: FinanceDemoState) => string;
};

function failure(error: string): SaleRegistrationResult {
  return { success: false, error };
}

function persistedIds(state: FinanceDemoState): Set<string> {
  return new Set([
    ...state.categories.map((category) => category.id),
    ...state.products.map((product) => product.id),
    ...state.sales.flatMap((sale) => [sale.id, sale.commandId]),
    ...state.payments.flatMap((payment) => [payment.id, payment.commandId]),
  ]);
}

/** IDs are lifetime reservations; persisted suffixes never influence the local counter. */
function createDefaultIdAllocator(): (kind: SaleLocalIdKind, state: FinanceDemoState) => string {
  const suffix: Record<SaleLocalIdKind, number> = { sale: 1, command: 1 };
  const reserved = new Set<string>();
  return (kind, state) => {
    const persisted = persistedIds(state);
    while (suffix[kind] <= Number.MAX_SAFE_INTEGER) {
      const candidate = `sale-${kind}-local-${suffix[kind]}`;
      suffix[kind] += 1;
      if (!persisted.has(candidate) && !reserved.has(candidate)) {
        reserved.add(candidate);
        return candidate;
      }
    }
    throw new Error("No se pudo asignar un identificador local de venta.");
  };
}

/** Accept 1.1's binary representation but never silently round a third decimal. */
function centsFromViewAmount(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > FINANCE_CENTS_MAX / 100) return null;
  const scaled = value * 100;
  const cents = Math.round(scaled);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) <= tolerance ? cents : null;
}

function allocation(
  nextId: (kind: SaleLocalIdKind, state: FinanceDemoState) => string,
  kind: SaleLocalIdKind,
  state: FinanceDemoState,
): string | null {
  try {
    return nextId(kind, state);
  } catch {
    return null;
  }
}

function signature(productId: string, quantity: number, unitAmount: number, options: SaleRegistrationOptions): string {
  return JSON.stringify([productId, quantity, unitAmount, options.soldAtStr, options.paymentMethod]);
}

/** Exposes only active products with their current category and stock to Caja staff. */
export function projectSaleDemoCatalog(state: FinanceDemoState, fixedActor: unknown): ProductCatalogItem[] {
  if (!isValidFinanceDemoState(state) || !canRegisterSale(fixedActor)) return [];
  const categories = new Map(state.categories.map((category) => [category.id, category.name]));
  return getCatalogProducts(state, fixedActor).flatMap((product) => {
    const categoryName = categories.get(product.categoryId);
    return categoryName === undefined ? [] : [{
      id: product.id,
      code: product.code,
      description: product.description,
      salePrice: product.priceCents / 100,
      stock: product.stock,
      categoryName,
    }];
  });
}

/**
 * Local-only bridge for the pure sale view. The actual state is read inside the
 * scheduled operation, so catalog edits and stock changes cannot sell a stale snapshot.
 */
export function createSaleDemoCallbackFactory(options: SaleDemoCallbackFactoryOptions): SaleDemoCallback {
  const nextId = options.nextId ?? createDefaultIdAllocator();
  let pending: PendingSale | null = null;
  let generation = 0;

  const callback: SaleDemoCallback = (productId, quantity, unitAmount, registrationOptions) => {
    const currentSignature = signature(productId, quantity, unitAmount, registrationOptions);
    if (pending) {
      return pending.signature === currentSignature
        ? pending.promise
        : Promise.resolve(failure("Hay una venta en curso. Esperá un momento."));
    }

    const operationGeneration = generation;
    const promise: Promise<SaleRegistrationResult> = Promise.resolve().then(() => {
      if (operationGeneration !== generation) return failure("La venta fue restablecida antes de registrarse.");
      const state = options.getState();
      if (!isValidFinanceDemoState(state)) return failure("El catálogo no es válido.");
      if (!canRegisterSale(options.fixedActor)) return failure("No autorizado.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2_147_483_647) return failure("La cantidad no es válida.");
      const unitAmountCents = centsFromViewAmount(unitAmount);
      if (unitAmountCents === null) return failure("El importe unitario no es válido.");
      const id = allocation(nextId, "sale", state);
      const commandId = allocation(nextId, "command", state);
      if (!id || !commandId) return failure("No se pudo asignar un identificador local de venta.");
      const transition = registerCatalogSale(state, {
        id,
        commandId,
        actor: options.fixedActor,
        productId,
        quantity,
        unitAmountCents,
        soldAt: registrationOptions.soldAtStr,
        paymentMethod: registrationOptions.paymentMethod,
      }, options.datePolicy.today());
      if (!transition.result.success) return failure(transition.result.error);
      if (!transition.result.idempotent) options.commit(transition.state);
      return { success: true as const };
    }).finally(() => {
      if (pending?.promise === promise) pending = null;
    });
    pending = { signature: currentSignature, promise };
    return promise;
  };

  callback.cancelPendingSale = () => {
    generation += 1;
    pending = null;
  };
  return callback;
}
