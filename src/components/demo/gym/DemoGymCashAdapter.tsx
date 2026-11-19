"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CajaShell } from "@/components/caja/CajaShell";
import { RegisterExpenseButtonView } from "@/components/expenses/RegisterExpenseButtonView";
import { ExpenseHistorySectionView } from "@/components/expenses/ExpenseHistorySectionView";
import { MixtaHistoryTabsView } from "@/components/finance/MixtaHistoryTabsView";
import { PaymentFiltersView } from "@/components/finance/PaymentFiltersView";
import { RevenueFiltersView } from "@/components/finance/RevenueFiltersView";
import { AlumnosRevenueView, MixtaRevenueView, ProductosRevenueView, RevenuePanelView } from "@/components/finance/RevenuePanelView";
import { RevenueViewSelectorView } from "@/components/finance/RevenueViewSelectorView";
import { PaymentHistorySectionView } from "@/components/payments/PaymentHistorySectionView";
import { RegisterPaymentSectionView } from "@/components/payments/RegisterPaymentSectionView";
import { NewSaleButtonView } from "@/components/sales/NewSaleButtonView";
import { SaleHistorySectionView } from "@/components/sales/SaleHistorySectionView";
import { Button } from "@/components/ui/Button";
import { projectGymSaleDemoCatalog } from "@/components/demo/finance/gym-sale-demo-adapters";
import { projectGymFinancePaymentStudentSelection } from "@/components/demo/finance/gym-finance-demo-projection";
import { projectDemoRevenue } from "@/components/demo/finance/revenue-demo-projection";
import { parseDemoRevenueFilters, type DemoRevenueFilters, type DemoRevenueMetric } from "@/components/demo/finance/revenue-demo-contract";
import type { RevenueActiveFilters, RevenueMonthlyPoint, RevenueNetMonthlyPoint, RevenueNetStats, RevenueStats, RevenueView } from "@/components/finance/revenue-view-contracts";
import { getGymDemoActorToken } from "@/components/demo/scenarios/gym-demo-directory";
import { useDemoGym } from "./DemoGymProvider";
import { useDemoGymFinance } from "./DemoGymFinanceProvider";
import { Warning } from "./DemoGymFeesAdapter";

type QueryValue = string | string[];
const LEGACY_PAYMENT_FILTER_KEYS = ["statsMode", "statsMonth", "statsTeacherId", "statsStudentId", "statsTeacherIds"] as const;

function updateQuery(query: URLSearchParams, values: Record<string, QueryValue>, clearLegacy = false): URLSearchParams {
  const next = new URLSearchParams(query);
  if (clearLegacy) for (const key of LEGACY_PAYMENT_FILTER_KEYS) next.delete(key);
  for (const [key, value] of Object.entries(values)) {
    const serialized = Array.isArray(value) ? value.filter(Boolean).join(",") : value;
    if (serialized) next.set(key, serialized);
    else next.delete(key);
  }
  return next;
}

function activeFilters(filters: DemoRevenueFilters): RevenueActiveFilters {
  return { from: filters.from, to: filters.to, teacherIds: filters.teacherIds, methodIds: filters.methods, studentType: filters.studentType, categoryId: filters.categoryId };
}
function revenueStats(metric: DemoRevenueMetric): RevenueStats {
  return { current: { total: metric.totalCents / 100, count: metric.count }, previous: { total: metric.previousTotalCents / 100, count: metric.previousCount }, totalChange: metric.totalChange, countChange: metric.countChange };
}
function monthly(rows: Array<{ month: string; totalCents: number; count: number }>): RevenueMonthlyPoint[] { return rows.map((row) => ({ month: row.month, total: row.totalCents / 100, count: row.count })); }
function netMonthly(rows: Array<{ month: string; incomeCents: number; expenseCents: number; netCents: number }>): RevenueNetMonthlyPoint[] { return rows.map((row) => ({ month: row.month, ingresos: row.incomeCents / 100, gastos: row.expenseCents / 100, resultado: row.netCents / 100 })); }
function netStats(metrics: { payments: DemoRevenueMetric; sales: DemoRevenueMetric; expenses: DemoRevenueMetric; grossIncome: Omit<DemoRevenueMetric, "countChange">; net: Omit<DemoRevenueMetric, "countChange"> }): RevenueNetStats {
  return {
    cuotas: revenueStats(metrics.payments), ventas: revenueStats(metrics.sales), gastos: revenueStats(metrics.expenses),
    ingresos: { current: { total: metrics.grossIncome.totalCents / 100, count: metrics.grossIncome.count }, previous: { total: metrics.grossIncome.previousTotalCents / 100, count: metrics.grossIncome.previousCount }, totalChange: metrics.grossIncome.totalChange },
    resultado: { current: metrics.net.totalCents / 100, previous: metrics.net.previousTotalCents / 100, change: metrics.net.totalChange },
  };
}
function fallbackName(value: string | null): string { return value ?? "Sin información"; }
function selectedRevenueView(query: URLSearchParams): RevenueView {
  const view = query.get("revenueView");
  return view === "productos" || view === "mixta" ? view : "alumnos";
}

/** GYM Caja mount. It owns URL filter adaptation, never ledger parsing or authorization. */
export function DemoGymCashAdapter() {
  const gym = useDemoGym();
  const finance = useDemoGymFinance();
  const actor = gym.selectedActor;
  const token = getGymDemoActorToken(actor.id);
  const paymentCallbacks = token ? finance.paymentCallbacks?.get(actor.id) ?? null : null;
  const saleCallbacks = token ? finance.saleCallbacks?.get(actor.id) ?? null : null;
  const paymentStudents = useMemo(() => token && finance.ready ? projectGymFinancePaymentStudentSelection(finance.state, token) : null, [finance.ready, finance.state, token]);
  const saleCatalog = useMemo(() => token && finance.ready ? projectGymSaleDemoCatalog(finance.state, token) : null, [finance.ready, finance.state, token]);

  useEffect(() => () => {
    paymentCallbacks?.cancelPending();
    saleCallbacks?.cancelPending();
  }, [paymentCallbacks, saleCallbacks]);

  if (!finance.ready || !gym.ready || !token || actor.role === "STUDENT") return <Loading />;
  if (!paymentCallbacks || !saleCallbacks || !paymentStudents?.success || !saleCatalog?.success) return <Failure error={!paymentStudents?.success ? paymentStudents?.error ?? "No se pudo preparar el registro de cuotas." : !saleCatalog?.success ? saleCatalog?.error ?? "No se pudo preparar las ventas." : "No se pudo preparar la caja."} />;

  const key = `${actor.id}:${finance.resetEpoch}`;
  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <CajaShell
        saleAction={<NewSaleButtonView key={key} products={saleCatalog.products} size="lg" datePolicy={finance.saleDatePolicy} onRegisterSale={saleCallbacks} />}
        expenseAction={actor.role === "ADMIN" ? <AdminExpenseAction /> : null}
        quotaAction={<RegisterPaymentSectionView key={key} students={paymentStudents.students} size="lg" variant="primary" label="Registrar cuota" datePolicy={{ today: () => finance.today }} onRegisterPayment={paymentCallbacks} onCancelPendingDuplicate={paymentCallbacks.cancelPendingDuplicate} />}
      >
        <div className="flex flex-col gap-4">
          <p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">Datos de demostración guardados solo en esta pestaña. Registrar cuotas, ventas o gastos actualiza el informe local y no genera recibos, cobros ni checkout reales.</p>
          {finance.warning && <Warning message={finance.warning} />}
          {actor.role === "ADMIN" && <AdminRevenuePanel key={key} />}
          <div>
            <Button variant="ghost" size="sm" onClick={finance.reset}>Restablecer datos financieros</Button>
            <p className="mt-2 text-xs text-gray-500 font-body">Solo se restablecen catálogo, ventas, cuotas y gastos de demostración; entrenamiento, PRs, accesos y turnos no cambian.</p>
          </div>
        </div>
      </CajaShell>
    </main>
  );
}

function AdminExpenseAction() {
  const gym = useDemoGym();
  const finance = useDemoGymFinance();
  const actor = gym.selectedActor;
  const token = getGymDemoActorToken(actor.id);
  // Guard the admin identity before fetching a callback or rendering an expense DTO.
  if (actor.role !== "ADMIN" || !token) return null;
  const callbacks = finance.revenueCallbacks?.get(actor.id) ?? null;
  return callbacks ? <RegisterExpenseButtonView size="lg" datePolicy={finance.expenseDatePolicy} onRegisterExpense={callbacks.registerExpense} /> : null;
}

export function AdminRevenuePanel() {
  const gym = useDemoGym();
  const finance = useDemoGymFinance();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const actor = gym.selectedActor;
  const token = getGymDemoActorToken(actor.id);
  // This gate deliberately precedes parser/projection/DTO work.
  if (actor.role !== "ADMIN" || !token) return null;
  const callbacks = finance.revenueCallbacks?.get(actor.id) ?? null;
  if (!callbacks || !finance.ready) return null;

  const query = new URLSearchParams(searchParams?.toString());
  const parsed = parseDemoRevenueFilters(query, finance.today);
  // An invalid period never reaches financial aggregation. Its recovery controls
  // use the same safe month fallback as the mounted BOX presentation.
  const fallback = parseDemoRevenueFilters(null, finance.today);
  const view = parsed.ok ? parsed.filters.revenueView : selectedRevenueView(query);
  const filters = parsed.ok
    ? parsed.filters
    : fallback.ok
      ? { ...fallback.filters, revenueView: view }
      : null;
  const projection = parsed.ok ? projectDemoRevenue(finance.state, token, query, finance.today) : null;
  function setQuery(values: Record<string, QueryValue>, clearLegacy = false) {
    const next = updateQuery(query, values, clearLegacy).toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }
  const successful = projection?.success ? projection : null;
  const options = successful?.filterOptions ?? { teachers: [], categories: [] };
  const current = filters ? activeFilters(filters) : null;
  const toggle = (values: readonly string[], value: string) => values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
  const selector = <RevenueViewSelectorView view={view} onSelect={(next) => setQuery({ revenueView: next === "alumnos" ? "" : next })} />;
  const controls = current && (view === "alumnos"
    ? <PaymentFiltersView teachers={options.teachers} isAdmin gymKind="GYM" current={current} onFromChange={(statsFrom) => setQuery({ statsFrom }, true)} onToChange={(statsTo) => setQuery({ statsTo }, true)} onTeacherToggle={(teacherId) => setQuery({ statsTeacherIds: toggle(filters!.teacherIds, teacherId) }, true)} onClearTeachers={() => setQuery({ statsTeacherIds: [] }, true)} onMethodToggle={(method) => setQuery({ statsMethods: toggle(filters!.methods, method) }, true)} onClearMethods={() => setQuery({ statsMethods: [] }, true)} onStudentTypeChange={(statsStudentType) => setQuery({ statsStudentType }, true)} />
    : <RevenueFiltersView current={current} categories={view === "productos" ? options.categories : undefined} onFromChange={(statsFrom) => setQuery({ statsFrom })} onToChange={(statsTo) => setQuery({ statsTo })} onMethodToggle={(method) => setQuery({ statsMethods: toggle(filters!.methods, method) })} onCategoryChange={(statsCategoryId) => setQuery({ statsCategoryId })} />);

  const reportError = !parsed.ok
    ? parsed.error
    : projection && !projection.success
      ? projection.error
      : "No se pudo consultar el informe financiero.";
  if (!successful) return <RevenuePanelView selector={selector}><div className="flex flex-col gap-4"><p role="alert" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{reportError}. Corregí el período para consultar el informe.</p>{controls}</div></RevenuePanelView>;
  if (successful.view === "alumnos") return <RevenuePanelView selector={selector}><AlumnosRevenueView stats={revenueStats(successful.metrics)} evolution={monthly(successful.evolution)} filters={controls} history={<PaymentHistorySectionView payments={successful.paymentHistory.map((row) => ({ ...row, amount: row.amountCents / 100, recordedByName: fallbackName(row.recordedByName) }))} isAdmin onUpdatePayment={callbacks.updatePayment} onDeletePayment={callbacks.deletePayment} />} /></RevenuePanelView>;
  if (successful.view === "productos") return <RevenuePanelView selector={selector}><ProductosRevenueView stats={revenueStats(successful.metrics)} evolution={monthly(successful.evolution)} filters={controls} history={<SaleHistorySectionView sales={successful.saleHistory.map((row) => ({ ...row, unitAmount: row.unitAmountCents / 100, totalAmount: row.totalAmountCents / 100, recordedByName: fallbackName(row.recordedByName) }))} onUpdateSale={callbacks.updateSale} onDeleteSale={callbacks.deleteSale} />} /></RevenuePanelView>;
  return <RevenuePanelView selector={selector}><MixtaRevenueView net={netStats(successful.metrics)} evolution={netMonthly(successful.evolution)} filters={controls} history={<MixtaHistoryTabsView cuotas={<PaymentHistorySectionView payments={successful.paymentHistory.map((row) => ({ ...row, amount: row.amountCents / 100, recordedByName: fallbackName(row.recordedByName) }))} isAdmin onUpdatePayment={callbacks.updatePayment} onDeletePayment={callbacks.deletePayment} />} ventas={<SaleHistorySectionView sales={successful.saleHistory.map((row) => ({ ...row, unitAmount: row.unitAmountCents / 100, totalAmount: row.totalAmountCents / 100, recordedByName: fallbackName(row.recordedByName) }))} onUpdateSale={callbacks.updateSale} onDeleteSale={callbacks.deleteSale} />} gastos={<ExpenseHistorySectionView expenses={successful.expenseHistory.map((row) => ({ ...row, amount: row.amountCents / 100, recordedByName: fallbackName(row.recordedByName) }))} onUpdateExpense={callbacks.updateExpense} onDeleteExpense={callbacks.deleteExpense} />} />} /></RevenuePanelView>;
}

function Loading() { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p className="text-sm text-gray-500 font-body italic">Preparando caja de demostración…</p></main>; }
function Failure({ error }: { error: string }) { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p role="alert" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{error}</p></main>; }
