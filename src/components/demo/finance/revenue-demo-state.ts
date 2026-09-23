// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_CENTS_MAX, POSTGRES_INT_MAX } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveCatalogSaleActor } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isPlainDemoRevenueRecord } from "./revenue-demo-contract.ts";
import type { FinanceDemoState, FinancePayment, FinanceSale } from "./finance-demo-types";

export type DemoHistoryResult = { success: true; id: string } | { success: false; error: string };
export type DemoHistoryTransition = { state: FinanceDemoState; result: DemoHistoryResult };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= FINANCE_CENTS_MAX;
}

function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= FINANCE_CENTS_MAX;
}

function isPositivePostgresInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= POSTGRES_INT_MAX;
}

function transition(state: FinanceDemoState, result: DemoHistoryResult): DemoHistoryTransition {
  return { state, result };
}

function failure(state: FinanceDemoState, error: string): DemoHistoryTransition {
  return transition(state, { success: false, error });
}

/** Edits/deletes share the actual actions' ADMIN-only policy, not the report permission. */
function fixedAdmin(actor: unknown): boolean {
  try {
    if (!isPlainDemoRevenueRecord(actor)) return false;
    return resolveCatalogSaleActor(actor)?.role === "ADMIN";
  } catch {
    return false;
  }
}

function usableState(state: FinanceDemoState): boolean {
  return isValidFinanceDemoState(state);
}

/** Mirrors updatePayment: only its positive Decimal(12,2) amount snapshot changes. */
export function updateDemoPayment(state: FinanceDemoState, rawCommand: unknown): DemoHistoryTransition {
  if (!usableState(state)) return failure(state, "El estado financiero no es válido.");
  if (!isRecord(rawCommand)
    || !hasOnlyKeys(rawCommand, ["actor", "paymentId", "amountCents"])
    || !hasOwn(rawCommand, "actor")
    || !hasOwn(rawCommand, "paymentId")
    || !hasOwn(rawCommand, "amountCents")) return failure(state, "El pago no es válido.");
  if (!fixedAdmin(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.paymentId)) return failure(state, "Pago no encontrado.");
  const amountCents = rawCommand.amountCents;
  if (!isPositiveCents(amountCents)) return failure(state, "El importe debe ser mayor a cero.");
  const payment = state.payments.find((candidate) => candidate.id === rawCommand.paymentId);
  if (!payment) return failure(state, "Pago no encontrado.");
  return transition({
    ...state,
    payments: state.payments.map((candidate): FinancePayment => candidate.id === payment.id
      ? { ...candidate, amountCents }
      : candidate),
  }, { success: true, id: payment.id });
}

/** Mirrors deletePayment: removing a payment never rewrites a student's due date. */
export function deleteDemoPayment(state: FinanceDemoState, rawCommand: unknown): DemoHistoryTransition {
  if (!usableState(state)) return failure(state, "El estado financiero no es válido.");
  if (!isRecord(rawCommand)
    || !hasOnlyKeys(rawCommand, ["actor", "paymentId"])
    || !hasOwn(rawCommand, "actor")
    || !hasOwn(rawCommand, "paymentId")) return failure(state, "El pago no es válido.");
  if (!fixedAdmin(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.paymentId) || !state.payments.some((payment) => payment.id === rawCommand.paymentId)) return failure(state, "Pago no encontrado.");
  return transition({ ...state, payments: state.payments.filter((payment) => payment.id !== rawCommand.paymentId) }, { success: true, id: rawCommand.paymentId });
}

/**
 * Mirrors updateSale's nullish partial update while keeping explicit null out
 * of the local command boundary. Empty or undefined fields retain snapshots.
 */
export function updateDemoSale(state: FinanceDemoState, rawCommand: unknown): DemoHistoryTransition {
  if (!usableState(state)) return failure(state, "El estado financiero no es válido.");
  if (!isRecord(rawCommand)
    || !hasOnlyKeys(rawCommand, ["actor", "saleId", "quantity", "unitAmountCents"])
    || !hasOwn(rawCommand, "actor")
    || !hasOwn(rawCommand, "saleId")) return failure(state, "La venta no es válida.");
  if (!fixedAdmin(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.saleId)) return failure(state, "Venta no encontrada.");
  const sale = state.sales.find((candidate) => candidate.id === rawCommand.saleId);
  if (!sale) return failure(state, "Venta no encontrada.");
  if ((hasOwn(rawCommand, "quantity") && rawCommand.quantity === null)
    || (hasOwn(rawCommand, "unitAmountCents") && rawCommand.unitAmountCents === null)) return failure(state, "La venta no es válida.");

  const quantity = rawCommand.quantity === undefined ? sale.quantity : rawCommand.quantity;
  const unitAmountCents = rawCommand.unitAmountCents === undefined ? sale.unitAmountCents : rawCommand.unitAmountCents;
  if (!isPositivePostgresInt(quantity)) return failure(state, "La cantidad debe ser un entero mayor o igual a 1.");
  if (!isCents(unitAmountCents)) return failure(state, "El importe unitario debe ser mayor o igual a cero.");
  const totalAmountCents = quantity * unitAmountCents;
  if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents > FINANCE_CENTS_MAX) return failure(state, "El importe total no es válido.");

  return transition({
    ...state,
    sales: state.sales.map((candidate): FinanceSale => candidate.id === sale.id
      ? { ...candidate, quantity, unitAmountCents, totalAmountCents }
      : candidate),
  }, { success: true, id: sale.id });
}

/** Mirrors deleteSale: deletion is history-only and never reconciles product stock. */
export function deleteDemoSale(state: FinanceDemoState, rawCommand: unknown): DemoHistoryTransition {
  if (!usableState(state)) return failure(state, "El estado financiero no es válido.");
  if (!isRecord(rawCommand)
    || !hasOnlyKeys(rawCommand, ["actor", "saleId"])
    || !hasOwn(rawCommand, "actor")
    || !hasOwn(rawCommand, "saleId")) return failure(state, "La venta no es válida.");
  if (!fixedAdmin(rawCommand.actor)) return failure(state, "No autorizado.");
  if (!isId(rawCommand.saleId) || !state.sales.some((sale) => sale.id === rawCommand.saleId)) return failure(state, "Venta no encontrada.");
  return transition({ ...state, sales: state.sales.filter((sale) => sale.id !== rawCommand.saleId) }, { success: true, id: rawCommand.saleId });
}
