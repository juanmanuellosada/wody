"use client";

import type { ReactNode } from "react";
import { PaymentEvolutionChart } from "@/components/PaymentEvolutionChart";
import { NetEvolutionChart } from "@/components/NetEvolutionChart";
import type { RevenueNetMonthlyPoint, RevenueNetStats, RevenueStats, RevenueMonthlyPoint } from "./revenue-view-contracts";

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
    <span className={[
      "text-[10px] font-heading font-bold uppercase tracking-[0.1em] ml-1",
      isPositive ? "text-green-400" : "text-brand-red",
    ].join(" ")}>
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

export function RevenuePanelView({ selector, children }: { selector: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {selector}
      {children}
    </div>
  );
}

export function AlumnosRevenueView({
  stats,
  evolution,
  filters,
  history,
}: {
  stats: RevenueStats;
  evolution: RevenueMonthlyPoint[];
  filters: ReactNode;
  history: ReactNode;
}) {
  const { current, previous, totalChange, countChange } = stats;

  return (
    <div className="flex flex-col gap-4">
      {filters}
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
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-4">Evolución mensual</p>
        <PaymentEvolutionChart data={evolution} />
      </div>
      {history}
    </div>
  );
}

export function ProductosRevenueView({
  stats,
  evolution,
  filters,
  history,
}: {
  stats: RevenueStats;
  evolution: RevenueMonthlyPoint[];
  filters: ReactNode;
  history: ReactNode;
}) {
  const { current, previous, totalChange, countChange } = stats;

  return (
    <div className="flex flex-col gap-4">
      {filters}
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
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-4">Evolución mensual</p>
        <PaymentEvolutionChart data={evolution} />
      </div>
      {history}
    </div>
  );
}

export function MixtaRevenueView({
  net,
  evolution,
  filters,
  history,
}: {
  net: RevenueNetStats;
  evolution: RevenueNetMonthlyPoint[];
  filters: ReactNode;
  history: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {filters}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Ingresos (cuotas + ventas)" value={`$${formatAmount(net.ingresos.current.total)}`} change={net.ingresos.totalChange} />
        <MetricCard label="Gastos" value={`$${formatAmount(net.gastos.current.total)}`} change={net.gastos.totalChange} />
        <MetricCard label="Resultado neto" value={`$${formatAmount(net.resultado.current)}`} change={net.resultado.change} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-line bg-panel p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">Cuotas</p>
          <p className="text-lg font-heading font-black tabular-nums text-white">${formatAmount(net.cuotas.current.total)}</p>
        </div>
        <div className="border border-line bg-panel p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">Ventas</p>
          <p className="text-lg font-heading font-black tabular-nums text-white">${formatAmount(net.ventas.current.total)}</p>
        </div>
      </div>
      <div className="border border-line bg-panel p-4">
        <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-4">Evolución mensual (ingresos vs. gastos)</p>
        <NetEvolutionChart data={evolution} />
      </div>
      {history}
    </div>
  );
}
