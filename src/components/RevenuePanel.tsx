/**
 * Revenue-panel server wrapper. The Caja caller owns the fresh revenue gate;
 * this component keeps every selected branch's live query set on the server.
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
import { PaymentFilters } from "@/components/PaymentFilters";
import { RevenueFilters } from "@/components/RevenueFilters";
import { RevenueViewSelector, type RevenueView } from "@/components/RevenueViewSelector";
import { PaymentHistorySection } from "@/components/PaymentHistorySection";
import { SaleHistorySection } from "@/components/SaleHistorySection";
import { MixtaHistoryTabs } from "@/components/MixtaHistoryTabs";
import {
  AlumnosRevenueView,
  MixtaRevenueView,
  ProductosRevenueView,
  RevenuePanelView,
} from "@/components/finance/RevenuePanelView";

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

  return (
    <AlumnosRevenueView
      stats={stats}
      evolution={evolution}
      filters={<PaymentFilters teachers={teachers} isAdmin gymKind={gymKind} current={activeFilters} />}
      history={<PaymentHistorySection payments={history} isAdmin />}
    />
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

  return (
    <ProductosRevenueView
      stats={stats}
      evolution={evolution}
      filters={<RevenueFilters current={activeFilters} categories={categories} />}
      history={<SaleHistorySection sales={history} />}
    />
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
    <MixtaRevenueView
      net={net}
      evolution={evolution}
      filters={<RevenueFilters current={activeFilters} />}
      history={<MixtaHistoryTabs payments={payments} sales={sales} expenses={expenses} />}
    />
  );
}

export async function RevenuePanel({ view, filters, teachers, categories, gymKind, activeFilters }: Props) {
  return (
    <RevenuePanelView selector={<RevenueViewSelector view={view} />}>
      {view === "alumnos" && (
        <AlumnosView filters={filters} teachers={teachers} gymKind={gymKind} activeFilters={activeFilters} />
      )}
      {view === "productos" && (
        <ProductosView filters={filters} categories={categories} activeFilters={activeFilters} />
      )}
      {view === "mixta" && <MixtaView filters={filters} activeFilters={activeFilters} />}
    </RevenuePanelView>
  );
}
