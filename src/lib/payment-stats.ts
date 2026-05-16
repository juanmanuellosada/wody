/**
 * Estadísticas de recaudación — funciones server-side.
 * Llamadas desde Server Components; no son server actions.
 * Todos los Decimal se convierten a number antes de retornar.
 */

export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";

export interface PaymentRecord {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  paidAt: string; // ISO string, serializable
  recordedByName: string;
  paymentMethod: PaymentMethod | null;
}

import { prisma } from "@/lib/prisma";

export interface PaymentStatsFilters {
  gymId: string;
  /** Rol del usuario que consulta: define el alcance de alumnos visibles. */
  role: "ADMIN" | "TEACHER";
  /** Id del usuario que consulta (requerido cuando role === "TEACHER"). */
  userId?: string;
  /** Inicio del período seleccionado (inclusive), UTC. */
  from: Date;
  /** Fin del período seleccionado (inclusive), UTC. */
  to: Date;
  /** Filtrar por uno o varios profesores (solo válido para ADMIN). */
  teacherIds?: string[];
  /** Filtrar por uno o varios métodos de pago. Filas con paymentMethod null no matchean. */
  methodIds?: PaymentMethod[];
}

export interface PeriodStats {
  total: number;
  count: number;
}

export interface PaymentStats {
  current: PeriodStats;
  previous: PeriodStats;
  /** Variación porcentual de recaudación: null si el período anterior fue 0. */
  totalChange: number | null;
  /** Variación porcentual de cantidad: null si el período anterior fue 0. */
  countChange: number | null;
}

export interface MonthlyPoint {
  /** Etiqueta "YYYY-MM" para identificar el mes. */
  month: string;
  total: number;
  count: number;
}

/**
 * Resuelve el conjunto de studentIds según el alcance por rol y los filtros
 * adicionales (teacherIds).
 * Retorna undefined cuando no hay restricción de studentId (ADMIN sin filtros)
 * y el array cuando hay que filtrar.
 */
async function resolveStudentScope(
  filters: PaymentStatsFilters
): Promise<string[] | undefined> {
  const { gymId, role, userId, teacherIds } = filters;

  // Restricción base por rol
  let baseStudentIds: string[] | undefined;

  if (role === "TEACHER" && userId) {
    // TEACHER: solo sus alumnos asignados
    const links = await prisma.teacherStudent.findMany({
      where: { teacherId: userId },
      select: { studentId: true },
    });
    baseStudentIds = links.map((l) => l.studentId);
  }
  // ADMIN sin filtros extra: undefined (= todo el gym)

  // Aplicar filtro adicional por teacherIds (solo ADMIN puede pasar esto)
  if (teacherIds && teacherIds.length > 0) {
    const links = await prisma.teacherStudent.findMany({
      where: { teacherId: { in: teacherIds }, teacher: { gymId } },
      select: { studentId: true },
    });
    const teacherStudentIds = [...new Set(links.map((l) => l.studentId))];
    baseStudentIds =
      baseStudentIds !== undefined
        ? baseStudentIds.filter((id) => teacherStudentIds.includes(id))
        : teacherStudentIds;
  }

  return baseStudentIds;
}

function buildWhereClause(
  gymId: string,
  from: Date,
  to: Date,
  studentIds: string[] | undefined,
  methodIds?: PaymentMethod[]
) {
  return {
    gymId,
    paidAt: { gte: from, lte: to },
    ...(studentIds !== undefined ? { studentId: { in: studentIds } } : {}),
    ...(methodIds && methodIds.length > 0
      ? { paymentMethod: { in: methodIds } }
      : {}),
  };
}

async function computePeriodStats(
  gymId: string,
  from: Date,
  to: Date,
  studentIds: string[] | undefined,
  methodIds?: PaymentMethod[]
): Promise<PeriodStats> {
  // If scope is empty array, return zeros immediately
  if (studentIds !== undefined && studentIds.length === 0) {
    return { total: 0, count: 0 };
  }

  const where = buildWhereClause(gymId, from, to, studentIds, methodIds);
  const agg = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
    _count: { id: true },
  });

  const total = Number(agg._sum.amount ?? 0);
  const count = agg._count.id;

  return { total, count };
}

/**
 * Calcula el período anterior de la misma duración que el actual.
 * e.g. si el período es 1 mes (1 mar – 31 mar), el anterior es 1 feb – 28 feb.
 */
function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1); // un ms antes del inicio actual
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Métricas del período + comparación contra el período anterior. */
export async function getPaymentStats(
  filters: PaymentStatsFilters
): Promise<PaymentStats> {
  const studentIds = await resolveStudentScope(filters);

  const prev = previousPeriod(filters.from, filters.to);

  const [current, previous] = await Promise.all([
    computePeriodStats(filters.gymId, filters.from, filters.to, studentIds, filters.methodIds),
    computePeriodStats(filters.gymId, prev.from, prev.to, studentIds, filters.methodIds),
  ]);

  return {
    current,
    previous,
    totalChange: percentChange(current.total, previous.total),
    countChange: percentChange(current.count, previous.count),
  };
}

/**
 * Evolución mensual de la recaudación dentro del período dado.
 * Agrupa los pagos por mes calendario ("YYYY-MM") y devuelve un array
 * ordenado cronológicamente con total y cantidad por mes.
 *
 * Se hace con una query raw agrupada por to_char(paidAt, 'YYYY-MM') para
 * evitar traer todos los registros al proceso Node.
 */
export async function getMonthlyEvolution(
  filters: PaymentStatsFilters
): Promise<MonthlyPoint[]> {
  const studentIds = await resolveStudentScope(filters);

  // If scope is empty, return empty
  if (studentIds !== undefined && studentIds.length === 0) {
    return [];
  }

  // Use findMany + group in app layer to avoid complex raw SQL branching with method filter.
  // This is acceptable: the result set is bounded by period + gym scope.
  const payments = await prisma.payment.findMany({
    where: buildWhereClause(filters.gymId, filters.from, filters.to, studentIds, filters.methodIds),
    select: { paidAt: true, amount: true },
    orderBy: { paidAt: "asc" },
  });

  // Group by "YYYY-MM"
  const byMonth = new Map<string, { total: number; count: number }>();
  for (const p of payments) {
    const month = p.paidAt.toISOString().slice(0, 7);
    const prev = byMonth.get(month) ?? { total: 0, count: 0 };
    byMonth.set(month, { total: prev.total + Number(p.amount), count: prev.count + 1 });
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, count }]) => ({ month, total, count }));
}

/**
 * Lista de pagos individuales dentro del período dado, respetando el alcance
 * por rol y los filtros extra (teacherId, studentId).
 * Devuelve registros serializables (sin Decimal ni Date raw).
 */
export async function getPaymentHistory(
  filters: PaymentStatsFilters
): Promise<PaymentRecord[]> {
  const studentIds = await resolveStudentScope(filters);

  if (studentIds !== undefined && studentIds.length === 0) {
    return [];
  }

  const payments = await prisma.payment.findMany({
    where: buildWhereClause(filters.gymId, filters.from, filters.to, studentIds, filters.methodIds),
    orderBy: { paidAt: "desc" },
    select: {
      id: true,
      studentId: true,
      amount: true,
      paidAt: true,
      paymentMethod: true,
      student: { select: { name: true } },
      recordedBy: { select: { name: true } },
    },
  });

  return payments.map((p) => ({
    id: p.id,
    studentId: p.studentId,
    studentName: p.student.name,
    amount: Number(p.amount),
    paidAt: p.paidAt.toISOString(),
    recordedByName: p.recordedBy.name,
    paymentMethod: p.paymentMethod as PaymentMethod | null,
  }));
}
