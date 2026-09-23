import type { FeeStudentType } from "./fees-contract";
import type { FinancePaymentMethod } from "./finance-demo-types";

export const DEMO_REVENUE_METHODS: readonly FinancePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];
export const DEMO_REVENUE_STUDENT_TYPES: readonly FeeStudentType[] = ["GENERAL", "PERSONALIZED", "MUSCULACION_LIBRE"];

export type DemoRevenueView = "alumnos" | "productos" | "mixta";
export type DemoRevenueFilters = {
  revenueView: DemoRevenueView;
  from: string;
  to: string;
  methods: FinancePaymentMethod[];
  teacherIds: string[];
  studentType: FeeStudentType | "";
  categoryId: string;
};

export type DemoRevenueFilterParseResult =
  | { ok: true; filters: DemoRevenueFilters }
  | { ok: false; error: string };

export type DemoRevenueMetric = {
  totalCents: number;
  count: number;
  totalChange: number | null;
  countChange: number | null;
};

export type DemoRevenueMonthlyPoint = {
  month: string;
  totalCents: number;
  count: number;
};

export type DemoNetMonthlyPoint = {
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type DemoRevenueFilterOptions = {
  teachers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
};

export type DemoPaymentHistoryRow = {
  id: string;
  studentId: string;
  studentName: string;
  amountCents: number;
  paidAt: string;
  recordedByName: string | null;
  paymentMethod: FinancePaymentMethod;
};

export type DemoSaleHistoryRow = {
  id: string;
  productId: string;
  productCode: number;
  productDescription: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unitAmountCents: number;
  totalAmountCents: number;
  paymentMethod: FinancePaymentMethod;
  soldAt: string;
  recordedByName: string | null;
};

export type DemoExpenseHistoryRow = {
  id: string;
  amountCents: number;
  description: string;
  spentAt: string;
  recordedByName: string | null;
};

export type DemoRevenueProjection =
  | {
    success: true;
    view: "alumnos";
    filters: DemoRevenueFilters;
    filterOptions: DemoRevenueFilterOptions;
    metrics: DemoRevenueMetric;
    evolution: DemoRevenueMonthlyPoint[];
    paymentHistory: DemoPaymentHistoryRow[];
  }
  | {
    success: true;
    view: "productos";
    filters: DemoRevenueFilters;
    filterOptions: DemoRevenueFilterOptions;
    metrics: DemoRevenueMetric;
    evolution: DemoRevenueMonthlyPoint[];
    saleHistory: DemoSaleHistoryRow[];
  }
  | {
    success: true;
    view: "mixta";
    filters: DemoRevenueFilters;
    filterOptions: DemoRevenueFilterOptions;
    metrics: {
      payments: DemoRevenueMetric;
      sales: DemoRevenueMetric;
      expenses: DemoRevenueMetric;
      grossIncome: Omit<DemoRevenueMetric, "countChange">;
      net: Omit<DemoRevenueMetric, "countChange">;
    };
    evolution: DemoNetMonthlyPoint[];
    paymentHistory: DemoPaymentHistoryRow[];
    saleHistory: DemoSaleHistoryRow[];
    expenseHistory: DemoExpenseHistoryRow[];
  };

export type DemoRevenueProjectionResult = DemoRevenueProjection | { success: false; error: string };

type QueryInput = URLSearchParams | Readonly<Record<string, unknown>> | null | undefined;

/** Actor callers must be ordinary records before any frozen-roster property lookup. */
export function isPlainDemoRevenueRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function queryValue(query: QueryInput, name: string): string | undefined {
  if (query instanceof URLSearchParams) return query.get(name) ?? undefined;
  const value = query?.[name];
  return typeof value === "string" ? value : undefined;
}

/** Date.UTC maps years 0–99 to 1900–1999, so use setUTCFullYear for the Gregorian DTO range. */
function utcDate(year: number, monthIndex: number, day: number): Date {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, monthIndex, day);
  return value;
}

export function isValidDemoRevenueDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9_999) return false;
  const parsed = utcDate(year, month - 1, day);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

/** Internal UTC arithmetic may cross into year 0000; accepted filter DTOs remain 0001–9999. */
export function demoRevenueDateToUtcMs(dateOnly: string): number {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return utcDate(year, month - 1, day).getTime();
}

export function demoRevenueDateAtUtcMilliseconds(milliseconds: number): string {
  const value = new Date(milliseconds);
  return `${value.getUTCFullYear().toString().padStart(4, "0")}-${(value.getUTCMonth() + 1).toString().padStart(2, "0")}-${value.getUTCDate().toString().padStart(2, "0")}`;
}

function monthBounds(today: string): { from: string; to: string } {
  const [year, month] = today.split("-").map(Number);
  const lastDay = utcDate(year, month, 0).getUTCDate();
  return {
    from: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`,
    to: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`,
  };
}

/**
 * Mirrors Caja's current query names. Regex-invalid dates independently fall
 * back to the injected Argentina-month bounds; calendar-invalid dates reject.
 */
export function parseDemoRevenueFilters(query: QueryInput, today: string): DemoRevenueFilterParseResult {
  if (!isValidDemoRevenueDate(today)) return { ok: false, error: "La fecha actual no es válida." };
  const defaults = monthBounds(today);
  const rawFrom = queryValue(query, "statsFrom");
  const rawTo = queryValue(query, "statsTo");
  const from = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : defaults.from;
  const to = rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : defaults.to;
  if (!isValidDemoRevenueDate(from) || !isValidDemoRevenueDate(to)) return { ok: false, error: "El período no es válido." };
  if (from > to) return { ok: false, error: "El período no es válido." };

  const rawView = queryValue(query, "revenueView");
  const rawMethods = queryValue(query, "statsMethods");
  const rawTeacherIds = queryValue(query, "statsTeacherIds");
  const rawStudentType = queryValue(query, "statsStudentType");
  const rawCategoryId = queryValue(query, "statsCategoryId");
  return {
    ok: true,
    filters: {
      revenueView: rawView === "productos" || rawView === "mixta" ? rawView : "alumnos",
      from,
      to,
      methods: rawMethods ? rawMethods.split(",").filter((value): value is FinancePaymentMethod => DEMO_REVENUE_METHODS.includes(value as FinancePaymentMethod)) : [],
      teacherIds: rawTeacherIds ? rawTeacherIds.split(",").filter(Boolean) : [],
      studentType: DEMO_REVENUE_STUDENT_TYPES.includes(rawStudentType as FeeStudentType) ? rawStudentType as FeeStudentType : "",
      categoryId: rawCategoryId?.trim() ?? "",
    },
  };
}
