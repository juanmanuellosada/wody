"use client";

import { useState } from "react";
import { RegisterExpenseButtonView } from "@/components/expenses/RegisterExpenseButtonView";
import { ExpenseHistorySectionView } from "@/components/expenses/ExpenseHistorySectionView";
import { MixtaHistoryTabsView } from "@/components/finance/MixtaHistoryTabsView";
import { PaymentFiltersView } from "@/components/finance/PaymentFiltersView";
import { RevenueFiltersView } from "@/components/finance/RevenueFiltersView";
import { AlumnosRevenueView, MixtaRevenueView, ProductosRevenueView, RevenuePanelView } from "@/components/finance/RevenuePanelView";
import { RevenueViewSelectorView } from "@/components/finance/RevenueViewSelectorView";
import { PaymentHistorySectionView } from "@/components/payments/PaymentHistorySectionView";
import { SaleHistorySectionView } from "@/components/sales/SaleHistorySectionView";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { canManageExpenses } from "./expense-demo-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { parseDemoRevenueFilters } from "./revenue-demo-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectDemoRevenue } from "./revenue-demo-projection.ts";
import type { DemoRevenueFilterOptions, DemoRevenueFilters, DemoRevenueMetric } from "./revenue-demo-contract";
import type { RevenueActiveFilters, RevenueMonthlyPoint, RevenueNetMonthlyPoint, RevenueNetStats, RevenueStats, RevenueView } from "@/components/finance/revenue-view-contracts";
import { useDemoFinance } from "./DemoFinanceProvider";

type QueryValue = string | string[];
const LEGACY_PAYMENT_FILTER_KEYS = ["statsMode", "statsMonth", "statsTeacherId", "statsStudentId", "statsTeacherIds"] as const;

function applyQueryValues(query: URLSearchParams, values: Record<string, QueryValue>): URLSearchParams {
  const next = new URLSearchParams(query);
  for (const [key, value] of Object.entries(values)) {
    const serialized = Array.isArray(value) ? value.filter(Boolean).join(",") : value;
    if (serialized) next.set(key, serialized);
    else next.delete(key);
  }
  return next;
}

/** Mirrors PaymentFilters' legacy-key cleanup without touching browser navigation. */
export function updateDemoPaymentFiltersQuery(query: URLSearchParams, values: Record<string, QueryValue>): URLSearchParams {
  const next = new URLSearchParams(query);
  for (const key of LEGACY_PAYMENT_FILTER_KEYS) next.delete(key);
  return applyQueryValues(next, values);
}

/** Revenue filters preserve every key except the requested local filter change. */
export function updateDemoRevenueFiltersQuery(query: URLSearchParams, values: Record<string, QueryValue>): URLSearchParams {
  return applyQueryValues(query, values);
}

/** Alumnos is the implicit default just as in the live URL adapter. */
export function updateDemoRevenueViewQuery(query: URLSearchParams, view: RevenueView): URLSearchParams {
  const next = new URLSearchParams(query);
  if (view === "alumnos") next.delete("revenueView");
  else next.set("revenueView", view);
  return next;
}

function fallbackName(name: string | null): string {
  return name ?? "Sin información";
}

/** Cents leave the authorized projection only at this presentation boundary. */
function mapRevenueStats(metric: DemoRevenueMetric): RevenueStats {
  return {
    current: { total: metric.totalCents / 100, count: metric.count },
    previous: { total: metric.previousTotalCents / 100, count: metric.previousCount },
    totalChange: metric.totalChange,
    countChange: metric.countChange,
  };
}

function mapActiveFilters(filters: DemoRevenueFilters): RevenueActiveFilters {
  return {
    from: filters.from,
    to: filters.to,
    teacherIds: filters.teacherIds,
    methodIds: filters.methods,
    studentType: filters.studentType,
    categoryId: filters.categoryId,
  };
}

function mapMonthly(points: Array<{ month: string; totalCents: number; count: number }>): RevenueMonthlyPoint[] {
  return points.map((point) => ({ month: point.month, total: point.totalCents / 100, count: point.count }));
}

function mapNetMonthly(points: Array<{ month: string; incomeCents: number; expenseCents: number; netCents: number }>): RevenueNetMonthlyPoint[] {
  return points.map((point) => ({
    month: point.month,
    ingresos: point.incomeCents / 100,
    gastos: point.expenseCents / 100,
    resultado: point.netCents / 100,
  }));
}

function mapNetStats(metrics: {
  payments: DemoRevenueMetric;
  sales: DemoRevenueMetric;
  expenses: DemoRevenueMetric;
  grossIncome: Omit<DemoRevenueMetric, "countChange">;
  net: Omit<DemoRevenueMetric, "countChange">;
}): RevenueNetStats {
  return {
    cuotas: mapRevenueStats(metrics.payments),
    ventas: mapRevenueStats(metrics.sales),
    gastos: mapRevenueStats(metrics.expenses),
    ingresos: {
      current: { total: metrics.grossIncome.totalCents / 100, count: metrics.grossIncome.count },
      previous: { total: metrics.grossIncome.previousTotalCents / 100, count: metrics.grossIncome.previousCount },
      totalChange: metrics.grossIncome.totalChange,
    },
    resultado: {
      current: metrics.net.totalCents / 100,
      previous: metrics.net.previousTotalCents / 100,
      change: metrics.net.totalChange,
    },
  };
}

function paymentHistoryRows(rows: Array<{
  id: string; studentId: string; studentName: string; amountCents: number; paidAt: string; recordedByName: string | null; paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";
}>) {
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    amount: row.amountCents / 100,
    paidAt: row.paidAt,
    recordedByName: fallbackName(row.recordedByName),
    paymentMethod: row.paymentMethod,
  }));
}

function saleHistoryRows(rows: Array<{
  id: string; productCode: number; productDescription: string; quantity: number; unitAmountCents: number; totalAmountCents: number; paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO"; soldAt: string; recordedByName: string | null;
}>) {
  return rows.map((row) => ({
    id: row.id,
    productCode: row.productCode,
    productDescription: row.productDescription,
    quantity: row.quantity,
    unitAmount: row.unitAmountCents / 100,
    totalAmount: row.totalAmountCents / 100,
    paymentMethod: row.paymentMethod,
    soldAt: row.soldAt,
    recordedByName: fallbackName(row.recordedByName),
  }));
}

function expenseHistoryRows(rows: Array<{ id: string; amountCents: number; description: string; spentAt: string; recordedByName: string | null }>) {
  return rows.map((row) => ({
    id: row.id,
    amount: row.amountCents / 100,
    description: row.description,
    spentAt: row.spentAt,
    recordedByName: fallbackName(row.recordedByName),
  }));
}

function selectedView(query: URLSearchParams): RevenueView {
  const view = query.get("revenueView");
  return view === "productos" || view === "mixta" ? view : "alumnos";
}

function controls(
  view: RevenueView,
  filters: DemoRevenueFilters,
  options: DemoRevenueFilterOptions,
  onPaymentChange: (values: Record<string, QueryValue>) => void,
  onRevenueChange: (values: Record<string, QueryValue>) => void,
) {
  const current = mapActiveFilters(filters);
  const toggle = (values: readonly string[], value: string) => values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];

  if (view === "alumnos") {
    return <PaymentFiltersView
      teachers={options.teachers}
      isAdmin
      gymKind="BOX"
      current={current}
      onFromChange={(statsFrom) => onPaymentChange({ statsFrom })}
      onToChange={(statsTo) => onPaymentChange({ statsTo })}
      onTeacherToggle={(teacherId) => onPaymentChange({ statsTeacherIds: toggle(filters.teacherIds, teacherId) })}
      onClearTeachers={() => onPaymentChange({ statsTeacherIds: [] })}
      onMethodToggle={(method) => onPaymentChange({ statsMethods: toggle(filters.methods, method) })}
      onClearMethods={() => onPaymentChange({ statsMethods: [] })}
      onStudentTypeChange={(statsStudentType) => onPaymentChange({ statsStudentType })}
    />;
  }

  return <RevenueFiltersView
    current={current}
    categories={view === "productos" ? options.categories : undefined}
    onFromChange={(statsFrom) => onRevenueChange({ statsFrom })}
    onToChange={(statsTo) => onRevenueChange({ statsTo })}
    onMethodToggle={(method) => onRevenueChange({ statsMethods: toggle(filters.methods, method) })}
    onCategoryChange={(statsCategoryId) => onRevenueChange({ statsCategoryId })}
  />;
}

function AuthorizedDemoRevenueAdapter() {
  const finance = useDemoFinance();
  const [query, setQuery] = useState(() => new URLSearchParams());
  const callbacks = finance.revenueCallbacks;
  const parsed = parseDemoRevenueFilters(query, finance.today);
  const projection = parsed.ok ? projectDemoRevenue(finance.state, financeCatalogSaleActors.admin, query, finance.today) : null;
  const fallback = parseDemoRevenueFilters(null, finance.today);
  const view = parsed.ok ? parsed.filters.revenueView : selectedView(query);
  const activeFilters = parsed.ok ? parsed.filters : fallback.ok ? { ...fallback.filters, revenueView: view } : null;

  if (!finance.ready || !callbacks || !activeFilters) return null;
  const successful = projection?.success === true ? projection : null;
  const filterOptions = successful?.filterOptions ?? { teachers: [], categories: [] };
  const onPaymentChange = (values: Record<string, QueryValue>) => setQuery((current) => updateDemoPaymentFiltersQuery(current, values));
  const onRevenueChange = (values: Record<string, QueryValue>) => setQuery((current) => updateDemoRevenueFiltersQuery(current, values));
  const selector = <RevenueViewSelectorView view={view} onSelect={(next) => setQuery((current) => updateDemoRevenueViewQuery(current, next))} />;
  const filterControls = controls(view, activeFilters, filterOptions, onPaymentChange, onRevenueChange);
  const reportError = !parsed.ok
    ? parsed.error
    : projection?.success === false
      ? projection.error
      : "No se pudo consultar el informe financiero.";

  if (!successful) {
    return (
      <RevenuePanelView selector={selector}>
        <div className="flex flex-col gap-4">
          <p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200" role="alert">
            {reportError}. Corregí el período para consultar el informe.
          </p>
          {filterControls}
        </div>
      </RevenuePanelView>
    );
  }

  if (successful.view === "alumnos") {
    return (
      <RevenuePanelView selector={selector}>
        <AlumnosRevenueView
          stats={mapRevenueStats(successful.metrics)}
          evolution={mapMonthly(successful.evolution)}
          filters={filterControls}
          history={<PaymentHistorySectionView
            payments={paymentHistoryRows(successful.paymentHistory)}
            isAdmin
            onUpdatePayment={callbacks.updatePayment}
            onDeletePayment={callbacks.deletePayment}
          />}
        />
      </RevenuePanelView>
    );
  }

  if (successful.view === "productos") {
    return (
      <RevenuePanelView selector={selector}>
        <ProductosRevenueView
          stats={mapRevenueStats(successful.metrics)}
          evolution={mapMonthly(successful.evolution)}
          filters={filterControls}
          history={<SaleHistorySectionView
            sales={saleHistoryRows(successful.saleHistory)}
            onUpdateSale={callbacks.updateSale}
            onDeleteSale={callbacks.deleteSale}
          />}
        />
      </RevenuePanelView>
    );
  }

  return (
    <RevenuePanelView selector={selector}>
      <MixtaRevenueView
        net={mapNetStats(successful.metrics)}
        evolution={mapNetMonthly(successful.evolution)}
        filters={filterControls}
        history={<MixtaHistoryTabsView
          cuotas={<PaymentHistorySectionView
            payments={paymentHistoryRows(successful.paymentHistory)}
            isAdmin
            onUpdatePayment={callbacks.updatePayment}
            onDeletePayment={callbacks.deletePayment}
          />}
          ventas={<SaleHistorySectionView
            sales={saleHistoryRows(successful.saleHistory)}
            onUpdateSale={callbacks.updateSale}
            onDeleteSale={callbacks.deleteSale}
          />}
          gastos={<ExpenseHistorySectionView
            expenses={expenseHistoryRows(successful.expenseHistory)}
            onUpdateExpense={callbacks.updateExpense}
            onDeleteExpense={callbacks.deleteExpense}
          />}
        />}
      />
    </RevenuePanelView>
  );
}

/** Designated-admin-only mount; the guard runs before state projection or DTO mapping. */
export function DemoRevenueAdapter() {
  const finance = useDemoFinance();
  if (!canManageExpenses(financeCatalogSaleActors.admin) || !finance.ready || !finance.revenueCallbacks) return null;
  return <AuthorizedDemoRevenueAdapter key={finance.resetEpoch} />;
}

/** Caja's designated action stays separate from the report's guarded mapping. */
export function DemoExpenseAction() {
  const finance = useDemoFinance();
  if (!canManageExpenses(financeCatalogSaleActors.admin) || !finance.ready || !finance.revenueCallbacks) return null;
  return <RegisterExpenseButtonView size="lg" datePolicy={finance.expenseDatePolicy} onRegisterExpense={finance.revenueCallbacks.registerExpense} />;
}
