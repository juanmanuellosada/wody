/**
 * Estadísticas de ventas y gastos — funciones server-side, hermanas de
 * payment-stats.ts. Se mantienen en un archivo separado porque las
 * funciones internas de payment-stats.ts (resolveStudentScope,
 * buildWhereClause, computePeriodStats) están atadas al modelo Payment y a
 * la lógica de alcance por profe/alumno, que no aplica a Sale/Expense.
 * Solo se duplican dos helpers puros y muy pequeños (previousPeriod,
 * percentChange); todo lo demás (getPaymentStats, getMonthlyEvolution) se
 * reusa vía import desde payment-stats.ts, que ya los exporta.
 */

import { prisma } from "@/lib/prisma";
import {
  getPaymentStats,
  getMonthlyEvolution,
  type PaymentStatsFilters,
  type PaymentMethod,
  type PeriodStats,
  type MonthlyPoint,
} from "@/lib/payment-stats";

function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface StatsWithChange {
  current: PeriodStats;
  previous: PeriodStats;
  totalChange: number | null;
  countChange: number | null;
}

// ─── Ventas (vista Productos) ────────────────────────────────────────────

export interface SaleStatsFilters {
  gymId: string;
  from: Date;
  to: Date;
  methodIds?: PaymentMethod[];
  categoryId?: string;
}

function buildSaleWhereClause(f: SaleStatsFilters) {
  return {
    gymId: f.gymId,
    soldAt: { gte: f.from, lte: f.to },
    ...(f.methodIds && f.methodIds.length > 0 ? { paymentMethod: { in: f.methodIds } } : {}),
    ...(f.categoryId ? { product: { categoryId: f.categoryId } } : {}),
  };
}

async function computeSalePeriodStats(f: SaleStatsFilters): Promise<PeriodStats> {
  const agg = await prisma.sale.aggregate({
    where: buildSaleWhereClause(f),
    _sum: { totalAmount: true },
    _count: { id: true },
  });
  return { total: Number(agg._sum.totalAmount ?? 0), count: agg._count.id };
}

export async function getSaleStats(filters: SaleStatsFilters): Promise<StatsWithChange> {
  const prev = previousPeriod(filters.from, filters.to);
  const [current, previous] = await Promise.all([
    computeSalePeriodStats(filters),
    computeSalePeriodStats({ ...filters, from: prev.from, to: prev.to }),
  ]);
  return {
    current,
    previous,
    totalChange: percentChange(current.total, previous.total),
    countChange: percentChange(current.count, previous.count),
  };
}

export async function getSaleMonthlyEvolution(filters: SaleStatsFilters): Promise<MonthlyPoint[]> {
  const sales = await prisma.sale.findMany({
    where: buildSaleWhereClause(filters),
    select: { soldAt: true, totalAmount: true },
    orderBy: { soldAt: "asc" },
  });

  const byMonth = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    const month = s.soldAt.toISOString().slice(0, 7);
    const prev = byMonth.get(month) ?? { total: 0, count: 0 };
    byMonth.set(month, { total: prev.total + Number(s.totalAmount), count: prev.count + 1 });
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, count }]) => ({ month, total, count }));
}

export interface SaleRecord {
  id: string;
  productCode: number;
  productDescription: string;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  soldAt: string;
  recordedByName: string;
}

export async function getSaleHistory(filters: SaleStatsFilters): Promise<SaleRecord[]> {
  const sales = await prisma.sale.findMany({
    where: buildSaleWhereClause(filters),
    orderBy: { soldAt: "desc" },
    select: {
      id: true,
      quantity: true,
      unitAmount: true,
      totalAmount: true,
      paymentMethod: true,
      soldAt: true,
      product: { select: { code: true, description: true } },
      recordedBy: { select: { name: true } },
    },
  });

  return sales.map((s) => ({
    id: s.id,
    productCode: s.product.code,
    productDescription: s.product.description,
    quantity: s.quantity,
    unitAmount: Number(s.unitAmount),
    totalAmount: Number(s.totalAmount),
    paymentMethod: s.paymentMethod as PaymentMethod,
    soldAt: s.soldAt.toISOString(),
    recordedByName: s.recordedBy.name,
  }));
}

// ─── Gastos ───────────────────────────────────────────────────────────────

export interface ExpenseStatsFilters {
  gymId: string;
  from: Date;
  to: Date;
}

function buildExpenseWhereClause(f: ExpenseStatsFilters) {
  return { gymId: f.gymId, spentAt: { gte: f.from, lte: f.to } };
}

async function computeExpensePeriodStats(f: ExpenseStatsFilters): Promise<PeriodStats> {
  const agg = await prisma.expense.aggregate({
    where: buildExpenseWhereClause(f),
    _sum: { amount: true },
    _count: { id: true },
  });
  return { total: Number(agg._sum.amount ?? 0), count: agg._count.id };
}

export async function getExpenseStats(filters: ExpenseStatsFilters): Promise<StatsWithChange> {
  const prev = previousPeriod(filters.from, filters.to);
  const [current, previous] = await Promise.all([
    computeExpensePeriodStats(filters),
    computeExpensePeriodStats({ ...filters, from: prev.from, to: prev.to }),
  ]);
  return {
    current,
    previous,
    totalChange: percentChange(current.total, previous.total),
    countChange: percentChange(current.count, previous.count),
  };
}

export async function getExpenseMonthlyEvolution(filters: ExpenseStatsFilters): Promise<MonthlyPoint[]> {
  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhereClause(filters),
    select: { spentAt: true, amount: true },
    orderBy: { spentAt: "asc" },
  });

  const byMonth = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const month = e.spentAt.toISOString().slice(0, 7);
    const prev = byMonth.get(month) ?? { total: 0, count: 0 };
    byMonth.set(month, { total: prev.total + Number(e.amount), count: prev.count + 1 });
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, count }]) => ({ month, total, count }));
}

export interface ExpenseRecord {
  id: string;
  amount: number;
  description: string;
  spentAt: string;
  recordedByName: string;
}

export async function getExpenseHistory(filters: ExpenseStatsFilters): Promise<ExpenseRecord[]> {
  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhereClause(filters),
    orderBy: { spentAt: "desc" },
    select: { id: true, amount: true, description: true, spentAt: true, recordedBy: { select: { name: true } } },
  });

  return expenses.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    description: e.description,
    spentAt: e.spentAt.toISOString(),
    recordedByName: e.recordedBy.name,
  }));
}

// ─── Resultado neto (vista Mixta) ─────────────────────────────────────────

export interface NetResultFilters {
  gymId: string;
  from: Date;
  to: Date;
  methodIds?: PaymentMethod[];
}

export interface NetResultStats {
  cuotas: StatsWithChange;
  ventas: StatsWithChange;
  gastos: StatsWithChange;
  ingresos: { current: PeriodStats; previous: PeriodStats; totalChange: number | null };
  resultado: { current: number; previous: number; change: number | null };
}

export async function getNetResultStats(filters: NetResultFilters): Promise<NetResultStats> {
  const paymentFilters: PaymentStatsFilters = {
    gymId: filters.gymId,
    role: "ADMIN",
    from: filters.from,
    to: filters.to,
    methodIds: filters.methodIds,
  };
  const saleFilters: SaleStatsFilters = {
    gymId: filters.gymId,
    from: filters.from,
    to: filters.to,
    methodIds: filters.methodIds,
  };
  const expenseFilters: ExpenseStatsFilters = { gymId: filters.gymId, from: filters.from, to: filters.to };

  const [cuotas, ventas, gastos] = await Promise.all([
    getPaymentStats(paymentFilters),
    getSaleStats(saleFilters),
    getExpenseStats(expenseFilters),
  ]);

  const ingresosCurrent: PeriodStats = {
    total: cuotas.current.total + ventas.current.total,
    count: cuotas.current.count + ventas.current.count,
  };
  const ingresosPrevious: PeriodStats = {
    total: cuotas.previous.total + ventas.previous.total,
    count: cuotas.previous.count + ventas.previous.count,
  };

  const resultadoCurrent = ingresosCurrent.total - gastos.current.total;
  const resultadoPrevious = ingresosPrevious.total - gastos.previous.total;

  return {
    cuotas,
    ventas,
    gastos,
    ingresos: {
      current: ingresosCurrent,
      previous: ingresosPrevious,
      totalChange: percentChange(ingresosCurrent.total, ingresosPrevious.total),
    },
    resultado: {
      current: resultadoCurrent,
      previous: resultadoPrevious,
      change: percentChange(resultadoCurrent, resultadoPrevious),
    },
  };
}

export interface NetMonthlyPoint {
  month: string;
  ingresos: number;
  gastos: number;
  resultado: number;
}

export async function getNetMonthlyEvolution(filters: NetResultFilters): Promise<NetMonthlyPoint[]> {
  const paymentFilters: PaymentStatsFilters = {
    gymId: filters.gymId,
    role: "ADMIN",
    from: filters.from,
    to: filters.to,
    methodIds: filters.methodIds,
  };
  const saleFilters: SaleStatsFilters = {
    gymId: filters.gymId,
    from: filters.from,
    to: filters.to,
    methodIds: filters.methodIds,
  };
  const expenseFilters: ExpenseStatsFilters = { gymId: filters.gymId, from: filters.from, to: filters.to };

  const [paymentMonthly, saleMonthly, expenseMonthly] = await Promise.all([
    getMonthlyEvolution(paymentFilters),
    getSaleMonthlyEvolution(saleFilters),
    getExpenseMonthlyEvolution(expenseFilters),
  ]);

  const byMonth = new Map<string, { ingresos: number; gastos: number }>();
  for (const p of paymentMonthly) {
    const entry = byMonth.get(p.month) ?? { ingresos: 0, gastos: 0 };
    entry.ingresos += p.total;
    byMonth.set(p.month, entry);
  }
  for (const s of saleMonthly) {
    const entry = byMonth.get(s.month) ?? { ingresos: 0, gastos: 0 };
    entry.ingresos += s.total;
    byMonth.set(s.month, entry);
  }
  for (const e of expenseMonthly) {
    const entry = byMonth.get(e.month) ?? { ingresos: 0, gastos: 0 };
    entry.gastos += e.total;
    byMonth.set(e.month, entry);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { ingresos, gastos }]) => ({ month, ingresos, gastos, resultado: ingresos - gastos }));
}
