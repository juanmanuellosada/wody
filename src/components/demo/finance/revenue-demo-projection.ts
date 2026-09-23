// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { resolveCatalogSaleActor } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { demoFeeIdentities } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { demoRevenueDateAtUtcMilliseconds, demoRevenueDateToUtcMs, isPlainDemoRevenueRecord, parseDemoRevenueFilters } from "./revenue-demo-contract.ts";
import type {
  DemoExpenseHistoryRow,
  DemoNetMonthlyPoint,
  DemoPaymentHistoryRow,
  DemoRevenueFilterOptions,
  DemoRevenueFilters,
  DemoRevenueMetric,
  DemoRevenueMonthlyPoint,
  DemoRevenueProjectionResult,
  DemoSaleHistoryRow,
} from "./revenue-demo-contract";
import type { FinanceDemoState, FinanceExpense, FinancePayment, FinanceProduct, FinanceSale } from "./finance-demo-types";

const DAY_MS = 24 * 60 * 60 * 1000;

function unauthorized(): DemoRevenueProjectionResult {
  return { success: false, error: "No autorizado." };
}

/** The report gate is deliberately first: invalid or hostile graphs are never inspected for denied callers. */
function designatedRevenueAdmin(rawActor: unknown): boolean {
  try {
    if (!isPlainDemoRevenueRecord(rawActor)) return false;
    const actor = resolveCatalogSaleActor(rawActor);
    return actor?.id === financeCatalogSaleActors.admin.id && actor.role === "ADMIN" && actor.canViewRevenue === true;
  } catch {
    return false;
  }
}

function previousRange(filters: DemoRevenueFilters): { from: string; to: string } {
  const from = demoRevenueDateToUtcMs(filters.from);
  const inclusiveTo = demoRevenueDateToUtcMs(filters.to) + DAY_MS - 1;
  const duration = inclusiveTo - from;
  const previousTo = from - 1;
  return {
    from: demoRevenueDateAtUtcMilliseconds(previousTo - duration + 1),
    to: demoRevenueDateAtUtcMilliseconds(previousTo),
  };
}

function inRange(dateOnly: string, from: string, to: string): boolean {
  return dateOnly >= from && dateOnly <= to;
}

function change(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
}

function checkedSum<T>(rows: readonly T[], amount: (row: T) => number): number | null {
  let total = 0;
  for (const row of rows) {
    const next = total + amount(row);
    if (!Number.isSafeInteger(next)) return null;
    total = next;
  }
  return total;
}

function metric<T>(currentRows: readonly T[], previousRows: readonly T[], amount: (row: T) => number): DemoRevenueMetric | null {
  const totalCents = checkedSum(currentRows, amount);
  const previousCents = checkedSum(previousRows, amount);
  if (totalCents === null || previousCents === null) return null;
  return {
    totalCents,
    count: currentRows.length,
    totalChange: change(totalCents, previousCents),
    countChange: change(currentRows.length, previousRows.length),
  };
}

const EXTRA_FROZEN_RECORDER_NAMES: Readonly<Record<string, string>> = Object.freeze({
  [financeCatalogSaleActors.unprivilegedAdmin.id]: "Administrador sin acceso a recaudación",
});

function recorderName(id: string): string | null {
  const identity = Object.values(demoFeeIdentities).find((candidate) => candidate.id === id);
  return identity?.name ?? EXTRA_FROZEN_RECORDER_NAMES[id] ?? null;
}

function dateTime(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`;
}

function paymentMatches(payment: FinancePayment, state: FinanceDemoState, filters: DemoRevenueFilters, from: string, to: string, includeStudentFilters: boolean): boolean {
  if (!inRange(payment.paidAt, from, to) || (filters.methods.length > 0 && !filters.methods.includes(payment.paymentMethod))) return false;
  if (!includeStudentFilters) return true;
  const student = state.students.find((candidate) => candidate.id === payment.studentId);
  if (!student || student.deletedAt) return false;
  if (filters.teacherIds.length > 0 && !student.assignedTeachers.some((teacher) => filters.teacherIds.includes(teacher.id))) return false;
  return !filters.studentType || student.studentType === filters.studentType;
}

function saleMatches(sale: FinanceSale, products: readonly FinanceProduct[], filters: DemoRevenueFilters, from: string, to: string, includeCategory: boolean): boolean {
  if (!inRange(sale.soldAt, from, to) || (filters.methods.length > 0 && !filters.methods.includes(sale.paymentMethod))) return false;
  if (!includeCategory || !filters.categoryId) return true;
  return products.find((product) => product.id === sale.productId)?.categoryId === filters.categoryId;
}

function expensesInRange(expenses: readonly FinanceExpense[], from: string, to: string): FinanceExpense[] {
  return expenses.filter((expense) => inRange(expense.spentAt, from, to));
}

function monthly<T>(rows: readonly T[], date: (row: T) => string, amount: (row: T) => number): DemoRevenueMonthlyPoint[] | null {
  const months = new Map<string, { totalCents: number; count: number }>();
  for (const row of rows) {
    const month = date(row).slice(0, 7);
    const current = months.get(month) ?? { totalCents: 0, count: 0 };
    const next = current.totalCents + amount(row);
    if (!Number.isSafeInteger(next)) return null;
    months.set(month, { totalCents: next, count: current.count + 1 });
  }
  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, value]) => ({ month, ...value }));
}

function paymentRows(rows: readonly FinancePayment[], state: FinanceDemoState): DemoPaymentHistoryRow[] {
  const studentNames = new Map(state.students.map((student) => [student.id, student.name]));
  return rows
    .map((payment) => ({
      id: payment.id,
      studentId: payment.studentId,
      studentName: studentNames.get(payment.studentId) ?? "",
      amountCents: payment.amountCents,
      paidAt: dateTime(payment.paidAt),
      recordedByName: recorderName(payment.recordedById),
      paymentMethod: payment.paymentMethod,
    }))
    // Stable sort preserves stored append order for same-date records; do not invent an ID ordering.
    .sort((left, right) => right.paidAt.localeCompare(left.paidAt));
}

function saleRows(rows: readonly FinanceSale[], state: FinanceDemoState): DemoSaleHistoryRow[] {
  const products = new Map(state.products.map((product) => [product.id, product]));
  const categories = new Map(state.categories.map((category) => [category.id, category]));
  return rows
    .map((sale) => {
      const product = products.get(sale.productId);
      const category = product ? categories.get(product.categoryId) : undefined;
      return {
        id: sale.id,
        productId: sale.productId,
        productCode: product?.code ?? 0,
        productDescription: product?.description ?? "",
        categoryId: product?.categoryId ?? "",
        categoryName: category?.name ?? "",
        quantity: sale.quantity,
        unitAmountCents: sale.unitAmountCents,
        totalAmountCents: sale.totalAmountCents,
        paymentMethod: sale.paymentMethod,
        soldAt: dateTime(sale.soldAt),
        recordedByName: recorderName(sale.recordedById),
      };
    })
    .sort((left, right) => right.soldAt.localeCompare(left.soldAt));
}

function expenseRows(rows: readonly FinanceExpense[]): DemoExpenseHistoryRow[] {
  return rows
    .map((expense) => ({
      id: expense.id,
      amountCents: expense.amountCents,
      description: expense.description,
      spentAt: dateTime(expense.spentAt),
      recordedByName: recorderName(expense.recordedById),
    }))
    .sort((left, right) => right.spentAt.localeCompare(left.spentAt));
}

function filterOptions(state: FinanceDemoState): DemoRevenueFilterOptions {
  const seenTeachers = new Set<string>();
  const teachers: DemoRevenueFilterOptions["teachers"] = [];
  for (const student of state.students) {
    if (student.deletedAt) continue;
    for (const teacher of student.assignedTeachers) {
      if (!seenTeachers.has(teacher.id)) {
        seenTeachers.add(teacher.id);
        teachers.push({ id: teacher.id, name: teacher.name });
      }
    }
  }
  return {
    teachers,
    categories: state.categories.map((category) => ({ id: category.id, name: category.name })),
  };
}

function netEvolution(payments: readonly FinancePayment[], sales: readonly FinanceSale[], expenses: readonly FinanceExpense[]): DemoNetMonthlyPoint[] | null {
  const values = new Map<string, { incomeCents: number; expenseCents: number }>();
  const add = (month: string, incomeCents: number, expenseCents: number): boolean => {
    const current = values.get(month) ?? { incomeCents: 0, expenseCents: 0 };
    const income = current.incomeCents + incomeCents;
    const expense = current.expenseCents + expenseCents;
    if (!Number.isSafeInteger(income) || !Number.isSafeInteger(expense)) return false;
    values.set(month, { incomeCents: income, expenseCents: expense });
    return true;
  };
  for (const payment of payments) if (!add(payment.paidAt.slice(0, 7), payment.amountCents, 0)) return null;
  for (const sale of sales) if (!add(sale.soldAt.slice(0, 7), sale.totalAmountCents, 0)) return null;
  for (const expense of expenses) if (!add(expense.spentAt.slice(0, 7), 0, expense.amountCents)) return null;
  const result: DemoNetMonthlyPoint[] = [];
  for (const [month, value] of [...values.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const netCents = value.incomeCents - value.expenseCents;
    if (!Number.isSafeInteger(netCents)) return null;
    result.push({ month, ...value, netCents });
  }
  return result;
}

/**
 * Computes only the selected report view after a fixed-roster authorization
 * gate. The returned DTO contains date strings and integer cents only.
 */
export function projectDemoRevenue(
  state: FinanceDemoState,
  actor: unknown,
  query: URLSearchParams | Readonly<Record<string, unknown>> | null | undefined,
  today: string,
): DemoRevenueProjectionResult {
  if (!designatedRevenueAdmin(actor)) return unauthorized();
  if (!isValidFinanceDemoState(state)) return { success: false, error: "El estado financiero no es válido." };
  const parsed = parseDemoRevenueFilters(query, today);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const filters = parsed.filters;
  const previous = previousRange(filters);
  const options = filterOptions(state);

  if (filters.revenueView === "alumnos") {
    const current = state.payments.filter((payment) => paymentMatches(payment, state, filters, filters.from, filters.to, true));
    const prior = state.payments.filter((payment) => paymentMatches(payment, state, filters, previous.from, previous.to, true));
    const metrics = metric(current, prior, (payment) => payment.amountCents);
    const evolution = monthly(current, (payment) => payment.paidAt, (payment) => payment.amountCents);
    if (!metrics || !evolution) return { success: false, error: "No se puede calcular el informe financiero con importes fuera de rango." };
    return { success: true, view: "alumnos", filters, filterOptions: options, metrics, evolution, paymentHistory: paymentRows(current, state) };
  }

  if (filters.revenueView === "productos") {
    const current = state.sales.filter((sale) => saleMatches(sale, state.products, filters, filters.from, filters.to, true));
    const prior = state.sales.filter((sale) => saleMatches(sale, state.products, filters, previous.from, previous.to, true));
    const metrics = metric(current, prior, (sale) => sale.totalAmountCents);
    const evolution = monthly(current, (sale) => sale.soldAt, (sale) => sale.totalAmountCents);
    if (!metrics || !evolution) return { success: false, error: "No se puede calcular el informe financiero con importes fuera de rango." };
    return { success: true, view: "productos", filters, filterOptions: options, metrics, evolution, saleHistory: saleRows(current, state) };
  }

  // Mixed cards intentionally ignore teacher/type/category, matching finance-stats.ts.
  const currentPayments = state.payments.filter((payment) => paymentMatches(payment, state, filters, filters.from, filters.to, false));
  const priorPayments = state.payments.filter((payment) => paymentMatches(payment, state, filters, previous.from, previous.to, false));
  const currentSales = state.sales.filter((sale) => saleMatches(sale, state.products, filters, filters.from, filters.to, false));
  const priorSales = state.sales.filter((sale) => saleMatches(sale, state.products, filters, previous.from, previous.to, false));
  const currentExpenses = expensesInRange(state.expenses, filters.from, filters.to);
  const priorExpenses = expensesInRange(state.expenses, previous.from, previous.to);
  const payments = metric(currentPayments, priorPayments, (payment) => payment.amountCents);
  const sales = metric(currentSales, priorSales, (sale) => sale.totalAmountCents);
  const expenses = metric(currentExpenses, priorExpenses, (expense) => expense.amountCents);
  const evolution = netEvolution(currentPayments, currentSales, currentExpenses);
  if (!payments || !sales || !expenses || !evolution) return { success: false, error: "No se puede calcular el informe financiero con importes fuera de rango." };
  const currentPaymentCents = checkedSum(currentPayments, (payment) => payment.amountCents);
  const previousPaymentCents = checkedSum(priorPayments, (payment) => payment.amountCents);
  const currentSaleCents = checkedSum(currentSales, (sale) => sale.totalAmountCents);
  const previousSaleCents = checkedSum(priorSales, (sale) => sale.totalAmountCents);
  const currentExpenseCents = checkedSum(currentExpenses, (expense) => expense.amountCents);
  const previousExpenseCents = checkedSum(priorExpenses, (expense) => expense.amountCents);
  if (currentPaymentCents === null || previousPaymentCents === null || currentSaleCents === null
    || previousSaleCents === null || currentExpenseCents === null || previousExpenseCents === null) {
    return { success: false, error: "No se puede calcular el informe financiero con importes fuera de rango." };
  }
  const grossCurrent = currentPaymentCents + currentSaleCents;
  const grossPrevious = previousPaymentCents + previousSaleCents;
  const netCurrent = grossCurrent - currentExpenseCents;
  const netPrevious = grossPrevious - previousExpenseCents;
  if (!Number.isSafeInteger(grossCurrent) || !Number.isSafeInteger(grossPrevious)
    || !Number.isSafeInteger(netCurrent) || !Number.isSafeInteger(netPrevious)) {
    return { success: false, error: "No se puede calcular el informe financiero con importes fuera de rango." };
  }
  const paymentHistory = state.payments.filter((payment) => paymentMatches(payment, state, filters, filters.from, filters.to, true));
  const saleHistory = currentSales;
  return {
    success: true,
    view: "mixta",
    filters,
    filterOptions: options,
    metrics: {
      payments,
      sales,
      expenses,
      grossIncome: { totalCents: grossCurrent, count: payments.count + sales.count, totalChange: change(grossCurrent, grossPrevious) },
      net: { totalCents: netCurrent, count: payments.count + sales.count - expenses.count, totalChange: change(netCurrent, netPrevious) },
    },
    evolution,
    paymentHistory: paymentRows(paymentHistory, state),
    saleHistory: saleRows(saleHistory, state),
    expenseHistory: expenseRows(currentExpenses),
  };
}
