"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { MonthlyPoint } from "@/lib/payment-stats";

interface Props {
  data: MonthlyPoint[];
}

function formatMonth(month: string): string {
  // "YYYY-MM" → "MMM YY" (es-AR)
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-panel border border-line px-3 py-2 text-xs font-heading font-bold">
      <p className="text-gray-400 uppercase tracking-[0.1em] mb-1">
        {label ? formatMonth(label) : ""}
      </p>
      <p className="text-white">
        ${value.toLocaleString("es-AR", { minimumFractionDigits: 0 })}
      </p>
    </div>
  );
}

export function PaymentEvolutionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-gray-600 font-body italic text-center py-8">
        Sin datos para el período seleccionado.
      </p>
    );
  }

  const chartData = data.map((p) => ({
    month: p.month,
    total: p.total,
    label: formatMonth(p.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
      >
        <CartesianGrid
          vertical={false}
          stroke="rgba(255,255,255,0.05)"
          strokeDasharray="4 4"
        />
        <XAxis
          dataKey="label"
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
        <Bar dataKey="total" fill="#e11d48" radius={[2, 2, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
