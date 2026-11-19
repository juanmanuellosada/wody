"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateArg } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import type { FeeBlockStatus, FeeProjection, FeeStatus, FeeStatusFilter } from "@/components/demo/finance/fees-contract";

type PaymentControlRow = FeeProjection["rows"][number] & {
  blockStatus: FeeBlockStatus;
};

type StatusTile = {
  key: FeeStatusFilter;
  href?: string;
  onSelect?: () => void;
};

export interface PaymentControlViewProps {
  rows: PaymentControlRow[];
  counts: FeeProjection["counts"];
  activeFilter: FeeStatusFilter;
  typeControl: ReactNode;
  statusTiles: StatusTile[];
  emptyMessage: string;
  rowActions?: Record<string, ReactNode>;
  notice?: ReactNode;
}

function statusLabel(status: FeeStatus): string {
  if (status.kind === "overdue") {
    return status.days === 1 ? "Atrasado 1 día" : `Atrasado ${status.days} días`;
  }
  if (status.kind === "due-soon") {
    if (status.days === 0) return "Vence hoy";
    return status.days === 1 ? "Vence mañana" : `Vence en ${status.days} días`;
  }
  return "Al día";
}

function statusClasses(status: FeeStatus): string {
  if (status.kind === "overdue") return "bg-brand-red/15 text-brand-red border border-brand-red/30";
  if (status.kind === "due-soon") return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";
  return "bg-green-500/10 text-green-400 border border-green-500/20";
}

const tilePresentation = {
  all: { label: "Todos", valueClass: "text-white", activeClass: "border-white/60 bg-white/5" },
  overdue: { label: "Atrasados", valueClass: "text-brand-red", activeClass: "border-brand-red/60 bg-brand-red/10" },
  "due-soon": { label: "Por vencer", valueClass: "text-yellow-400", activeClass: "border-yellow-500/60 bg-yellow-500/10" },
  ok: { label: "Al día", valueClass: "text-green-400", activeClass: "border-green-500/60 bg-green-500/10" },
  exempt: { label: "Exentos", valueClass: "text-purple-400", activeClass: "border-purple-500/60 bg-purple-500/10" },
} as const;

function FeeStatusBadge({ row, mobile = false }: { row: PaymentControlRow; mobile?: boolean }) {
  const padding = mobile ? "px-2 py-0.5" : "px-2.5 py-1 inline-block";
  return (
    <div className={mobile ? "flex flex-col gap-1 items-end flex-shrink-0" : "flex flex-col gap-1 items-start"}>
      {row.paymentExempt ? (
        <span
          className={`text-xs font-heading font-bold uppercase tracking-[0.15em] ${padding} bg-purple-500/10 text-purple-400 border border-purple-500/30`}
          title={row.paymentExemptReason ?? undefined}
        >
          Exento
        </span>
      ) : row.status ? (
        <span className={["text-xs font-heading font-bold uppercase tracking-[0.15em]", padding, statusClasses(row.status)].join(" ")}>
          {statusLabel(row.status)}
        </span>
      ) : null}
      {row.blockStatus.blocked && (
        <span
          className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 inline-block bg-brand-red/15 text-brand-red border border-brand-red/30"
          title={
            row.blockStatus.kind === "overdue"
              ? `Auto-bloqueado: ${row.blockStatus.days} días de atraso`
              : "Bloqueado manualmente"
          }
        >
          {row.blockStatus.kind === "overdue" ? "Auto-bloq." : "Bloqueado"}
        </span>
      )}
    </div>
  );
}

function FeeActions({ rowId, rowActions }: { rowId: string; rowActions?: Record<string, ReactNode> }) {
  const actions = rowActions?.[rowId];
  return actions ? <div className="flex items-center justify-end gap-2 flex-wrap">{actions}</div> : null;
}

/** Shared Cuotas presentation. Adapters own navigation, data access, and operational actions. */
export function PaymentControlView({
  rows,
  counts,
  activeFilter,
  typeControl,
  statusTiles,
  emptyMessage,
  rowActions,
  notice,
}: PaymentControlViewProps) {
  return (
    <div className="flex flex-col gap-10">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
              Control de Cuotas
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Cuotas
            </h1>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {typeControl}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {statusTiles.map((tile) => {
                const presentation = tilePresentation[tile.key];
                const isActive = activeFilter === tile.key;
                const className = [
                  "text-center px-4 py-2 border transition-colors duration-200",
                  isActive ? presentation.activeClass : "border-line hover:border-edge hover:bg-white/[0.02]",
                ].join(" ");
                const contents = <>
                  <p className={`text-2xl font-heading font-black tabular-nums ${presentation.valueClass}`}>{counts[tile.key]}</p>
                  <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">{presentation.label}</p>
                </>;
                if (tile.href) {
                  return <Link key={tile.key} href={tile.href} aria-current={isActive ? "page" : undefined} className={className}>{contents}</Link>;
                }
                return (
                  <button
                    key={tile.key}
                    type="button"
                    onClick={tile.onSelect}
                    aria-pressed={isActive}
                    className={`${className} appearance-none bg-transparent`}
                  >
                    {contents}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {notice}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">{emptyMessage}</p>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel">
                  {["Alumno", "Próximo pago", "Estado", ""].map((heading) => (
                    <th key={heading} className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line hover:bg-hover transition-colors duration-200">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-white font-heading font-bold">{row.name}</span>
                        <span className="text-gray-500 text-xs font-body">{row.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-300 font-heading font-bold">
                      {row.paymentExempt ? <span className="text-gray-500 italic font-body font-normal text-xs">—</span> : formatDateArg(new Date(row.nextPaymentDate))}
                    </td>
                    <td className="px-4 py-3.5"><FeeStatusBadge row={row} /></td>
                    <td className="px-4 py-3.5"><FeeActions rowId={row.id} rowActions={rowActions} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden flex flex-col gap-3">
            {rows.map((row) => (
              <Card key={row.id}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-heading font-bold text-sm truncate">{row.name}</p>
                      <p className="text-gray-500 text-xs font-body truncate">{row.email}</p>
                    </div>
                    <FeeStatusBadge row={row} mobile />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">Próximo pago</span>
                      <span className="text-white font-heading font-bold text-sm">
                        {row.paymentExempt ? <span className="text-gray-500 italic font-body font-normal text-xs">—</span> : formatDateArg(new Date(row.nextPaymentDate))}
                      </span>
                    </div>
                    <FeeActions rowId={row.id} rowActions={rowActions} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
