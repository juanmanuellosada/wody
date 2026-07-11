/**
 * Panel de recaudación — Server Component.
 * Calcula métricas y evolución mensual en el servidor y pasa datos serializados
 * a los Client Components (filtros, gráfico, historial).
 *
 * Solo se debe renderizar cuando el usuario tiene permiso para ver la
 * recaudación (role ADMIN + canViewRevenue): el caller es responsable de
 * ese gate, así los datos ni se calculan ni se envían al cliente si no aplica.
 *
 * Ofrece 3 vistas seleccionables (querystring `revenueView`): Alumnos (cuotas,
 * comportamiento histórico), Productos (ventas) y Mixta (resultado neto).
 */

import type { GymKind, StudentType } from "@prisma/client";
import { getPaymentStats, getMonthlyEvolution, getPaymentHistory } from "@/lib/payment-stats";
import type { PaymentStatsFilters, PaymentMethod } from "@/lib/payment-stats";
import {
  getSaleStats,
  getSaleMonthlyEvolution,
  getSaleHistory,
  getExpenseHistory,
  getNetResultStats,
  getNetMonthlyEvolution,
  type SaleStatsFilters,
  type ExpenseStatsFilters,
  type NetResultFilters,
} from "@/lib/finance-stats";
import { PaymentEvolutionChart } from "@/components/PaymentEvolutionChart";
import { NetEvolutionChart } from "@/components/NetEvolutionChart";
import { PaymentFilters } from "@/components/PaymentFilters";
import { RevenueFilters } from "@/components/RevenueFilters";
import { RevenueViewSelector, type RevenueView } from "@/components/RevenueViewSelector";
import { PaymentHistorySection } from "@/components/PaymentHistorySection";
import { SaleHistorySection } from "@/components/SaleHistorySection";
import { MixtaHistoryTabs } from "@/components/MixtaHistoryTabs";

interface Teacher {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface ActiveFilters {
  from: string;
  to: string;
  teacherIds: string[];
  methodIds: PaymentMethod[];
  studentType: StudentType | "";
  categoryId: string;
}

interface Props {
  view: RevenueView;
  filters: PaymentStatsFilters;
  teachers: Teacher[];
  categories: Category[];
  gymKind: GymKind | null | undefined;
  activeFilters: ActiveFilters;
}

function formatAmount(value: number): string {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function ChangeIndicator({ change }: { change: number | null }) {
  if (change === null) return null;
  const isPositive = change >= 0;
  return (
    <span
      className={[
        "text-[10px] font-heading font-bold uppercase tracking-[0.1em] ml-1",
        isPositive ? "text-green-400" : "text-brand-red",
      ].join(" ")}
    >
      {isPositive ? "+" : ""}
      {change}%
    </span>
  );
}

function MetricCard({
  label,
  value,
  change,
  compareLabel,
}: {
  label: string;
  value: string;
  change: number | null;
  compareLabel?: string;
}) {
  return (
    <div className="border border-line bg-panel p-4">
      <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">{label}</p>
      <p className="text-2xl font-heading font-black tabular-nums text-white">
        {value}
        <ChangeIndicator change={change} />
      </p>
      {compareLabel && <p className="text-[10px] text-gray-600 font-body mt-1">{compareLabel}</p>}
    </div>
  );
}

async function AlumnosView({
  filters,
  teachers,
  gymKind,
  activeFilters,
}: {
  filters: PaymentStatsFilters;
  teachers: Teacher[];
  gymKind: GymKind | null | undefined;
  activeFilters: ActiveFilters;
}) {
  const [stats, evolution, history] = await Promise.all([
    getPaymentStats(filters),
    getMonthlyEvolution(filters),
    getPaymentHistory(filters),
  ]);

  const { current, previous, totalChange, countChange } = stats;

  return (
    <div className="flex flex-col gap-4">
      <PaymentFilters teachers={teachers} isAdmin gymKind={gymKind} current={activeFilters} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          label="Recaudación"
          value={`$${formatAmount(current.total)}`}
          change={totalChange}
          compareLabel={previous.total > 0 ? `vs. $${formatAmount(previous.total)} período anterior` : undefined}
        />
        <MetricCard
          label="Pagos"
          value={String(current.count)}
          change={countChange}
          compareLabel={previous.count > 0 ? `vs. ${previous.count} período anterior` : undefined}
        />
      </div>

      <div className="border border-line bg-panel p-4">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-4">
          Evolución mensual
        </p>
        <PaymentEvolutionChart data={evolution} />
      </div>

      <PaymentHistorySection payments={history} isAdmin />
    </div>
  );
}

async function ProductosView({
  filters,
  categories,
  activeFilters,
}: {
  filters: PaymentStatsFilters;
  categories: Category[];
  activeFilters: ActiveFilters;
}) {
  const saleFilters: SaleStatsFilters = {
    gymId: filters.gymId,
    from: filters.from,
    to: filters.to,
    methodIds: filters.methodIds,
    categoryId: activeFilters.categoryId || undefined,
  };

  const [stats, evolution, history] = await Promise.all([
    getSaleStats(saleFilters),
    getSaleMonthlyEvolution(saleFilters),
    getSaleHistory(saleFilters),
  ]);

  const { current, previous, totalChange, countChange } = stats;

  return (
    <div className="flex flex-col gap-4">
      <RevenueFilters current={activeFilters} categories={categories} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          label="Recaudación por ventas"
          value={`$${formatAmount(current.total)}`}
          change={totalChange}
          compareLabel={previous.total > 0 ? `vs. $${formatAmount(previous.total)} período anterior` : undefined}
        />
        <MetricCard
          label="Ventas"
          value={String(current.count)}
          change={countChange}
          compareLabel={previous.count > 0 ? `vs. ${previous.count} período anterior` : undefined}
        />
      </div>

      <div className="border border-line bg-panel p-4">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-4">
          Evolución mensual
        </p>
        <PaymentEvolutionChart data={evolution} />
      </div>

      <SaleHistorySection sales={history} />
    </div>
  );
}

async function MixtaView({
  filters,
  activeFilters,
}: {
  filters: PaymentStatsFilters;
  activeFilters: ActiveFilters;
}) {
  const netFilters: NetResultFilters = {
    gymId: filters.gymId,
    from: filters.from,
    to: filters.to,
    methodIds: filters.methodIds,
  };
  const expenseFilters: ExpenseStatsFilters = { gymId: filters.gymId, from: filters.from, to: filters.to };
  const saleFilters: SaleStatsFilters = {
    gymId: filters.gymId,
    from: filters.from,
    to: filters.to,
    methodIds: filters.methodIds,
  };

  const [net, evolution, payments, sales, expenses] = await Promise.all([
    getNetResultStats(netFilters),
    getNetMonthlyEvolution(netFilters),
    getPaymentHistory(filters),
    getSaleHistory(saleFilters),
    getExpenseHistory(expenseFilters),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <RevenueFilters current={activeFilters} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Ingresos (cuotas + ventas)"
          value={`$${formatAmount(net.ingresos.current.total)}`}
          change={net.ingresos.totalChange}
        />
        <MetricCard label="Gastos" value={`$${formatAmount(net.gastos.current.total)}`} change={net.gastos.totalChange} />
        <MetricCard
          label="Resultado neto"
          value={`$${formatAmount(net.resultado.current)}`}
          change={net.resultado.change}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-line bg-panel p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">
            Cuotas
          </p>
          <p className="text-lg font-heading font-black tabular-nums text-white">
            ${formatAmount(net.cuotas.current.total)}
          </p>
        </div>
        <div className="border border-line bg-panel p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">
            Ventas
          </p>
          <p className="text-lg font-heading font-black tabular-nums text-white">
            ${formatAmount(net.ventas.current.total)}
          </p>
        </div>
      </div>

      <div className="border border-line bg-panel p-4">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-4">
          Evolución mensual (ingresos vs. gastos)
        </p>
        <NetEvolutionChart data={evolution} />
      </div>

      <MixtaHistoryTabs payments={payments} sales={sales} expenses={expenses} />
    </div>
  );
}

export async function RevenuePanel({ view, filters, teachers, categories, gymKind, activeFilters }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <RevenueViewSelector view={view} />
      {view === "alumnos" && (
        <AlumnosView filters={filters} teachers={teachers} gymKind={gymKind} activeFilters={activeFilters} />
      )}
      {view === "productos" && (
        <ProductosView filters={filters} categories={categories} activeFilters={activeFilters} />
      )}
      {view === "mixta" && <MixtaView filters={filters} activeFilters={activeFilters} />}
    </div>
  );
}
