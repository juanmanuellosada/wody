/**
 * Panel de recaudación — Server Component.
 * Calcula métricas y evolución mensual en el servidor y pasa datos serializados
 * a los Client Components (filtros, gráfico, historial).
 *
 * Solo se debe renderizar cuando el usuario tiene permiso para ver la
 * recaudación (role ADMIN + canViewRevenue): el caller es responsable de
 * ese gate, así los datos ni se calculan ni se envían al cliente si no aplica.
 */

import type { GymKind } from "@prisma/client";
import { getPaymentStats, getMonthlyEvolution, getPaymentHistory } from "@/lib/payment-stats";
import { PaymentEvolutionChart } from "@/components/PaymentEvolutionChart";
import { PaymentFilters } from "@/components/PaymentFilters";
import { PaymentHistorySection } from "@/components/PaymentHistorySection";
import type { PaymentStatsFilters, PaymentMethod } from "@/lib/payment-stats";
import type { StudentType } from "@prisma/client";

interface Teacher {
  id: string;
  name: string;
}

interface Props {
  filters: PaymentStatsFilters;
  teachers: Teacher[];
  gymKind: GymKind | null | undefined;
  /** Parsed filter values to pass down to PaymentFilters for current state display */
  activeFilters: {
    from: string;
    to: string;
    teacherIds: string[];
    methodIds: PaymentMethod[];
    studentType: StudentType | "";
  };
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
      {isPositive ? "+" : ""}{change}%
    </span>
  );
}

export async function RevenuePanel({ filters, teachers, gymKind, activeFilters }: Props) {
  const [stats, evolution, history] = await Promise.all([
    getPaymentStats(filters),
    getMonthlyEvolution(filters),
    getPaymentHistory(filters),
  ]);

  const { current, previous, totalChange, countChange } = stats;

  return (
    <div className="flex flex-col gap-4">
      <PaymentFilters
        teachers={teachers}
        isAdmin
        gymKind={gymKind}
        current={activeFilters}
      />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Total */}
        <div className="border border-line bg-panel p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">
            Recaudación
          </p>
          <p className="text-2xl font-heading font-black tabular-nums text-white">
            ${formatAmount(current.total)}
            <ChangeIndicator change={totalChange} />
          </p>
          {previous.total > 0 && (
            <p className="text-[10px] text-gray-600 font-body mt-1">
              vs. ${formatAmount(previous.total)} período anterior
            </p>
          )}
        </div>

        {/* Count */}
        <div className="border border-line bg-panel p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">
            Pagos
          </p>
          <p className="text-2xl font-heading font-black tabular-nums text-white">
            {current.count}
            <ChangeIndicator change={countChange} />
          </p>
          {previous.count > 0 && (
            <p className="text-[10px] text-gray-600 font-body mt-1">
              vs. {previous.count} período anterior
            </p>
          )}
        </div>
      </div>

      {/* Monthly evolution chart */}
      <div className="border border-line bg-panel p-4">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-4">
          Evolución mensual
        </p>
        <PaymentEvolutionChart data={evolution} />
      </div>

      {/* Payment history (with edit/delete for ADMIN) */}
      <PaymentHistorySection payments={history} isAdmin />
    </div>
  );
}
