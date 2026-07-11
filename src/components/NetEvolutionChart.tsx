"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import type { NetMonthlyPoint } from "@/lib/finance-stats";

interface Props {
  data: NetMonthlyPoint[];
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function formatAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-panel border border-line px-3 py-2 text-xs font-heading font-bold">
      <p className="text-gray-400 uppercase tracking-[0.1em] mb-1">{label ? formatMonth(label) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: ${p.value.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
}

export function NetEvolutionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-gray-600 font-body italic text-center py-8">
        Sin datos para el período seleccionado.
      </p>
    );
  }

  const chartData = data.map((p) => ({ month: p.month, Ingresos: p.ingresos, Gastos: p.gastos }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--font-heading)", fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={formatAmount}
          tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "var(--font-heading)", fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend
          wrapperStyle={{
            fontSize: 10,
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        />
        <Bar dataKey="Ingresos" fill="#22c55e" radius={[2, 2, 0, 0]} maxBarSize={30} />
        <Bar dataKey="Gastos" fill="#e11d48" radius={[2, 2, 0, 0]} maxBarSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
}
