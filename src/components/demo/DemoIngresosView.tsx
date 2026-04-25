import Link from "next/link";
import { formatDateArg } from "@/lib/dates";
import { formatMemberNumber } from "@/lib/memberNumber";
import type { DemoAccessRow, AccessState } from "./demoIngresosData";

type StateFilter = "all" | "GRANTED" | "DENIED" | "PENDING";

function stateLabel(state: AccessState): string {
  if (state === "GRANTED") return "Permitido";
  if (state === "DENIED") return "Denegado";
  return "Pendiente";
}

function stateClasses(state: AccessState): string {
  if (state === "GRANTED") {
    return "bg-green-500/10 text-green-400 border border-green-500/30";
  }
  if (state === "DENIED") {
    return "bg-brand-red/15 text-brand-red border border-brand-red/30";
  }
  return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

interface Props {
  rows: DemoAccessRow[];
  basePath: string;
  activeFilter: StateFilter;
}

export function DemoIngresosView({ rows, basePath, activeFilter }: Props) {
  const grantedCount = rows.filter((r) => r.state === "GRANTED").length;
  const deniedCount = rows.filter((r) => r.state === "DENIED").length;
  const pendingCount = rows.filter((r) => r.state === "PENDING").length;

  const visibleRows =
    activeFilter === "all"
      ? rows
      : rows.filter((r) => r.state === activeFilter);

  const filterHref = (f: StateFilter) =>
    f === "all" ? basePath : `${basePath}?estado=${f}`;

  return (
    <div className="flex flex-col gap-10">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
              Control de Accesos
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Ingresos
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {(
              [
                {
                  key: "all",
                  label: "Todos",
                  value: rows.length,
                  valueClass: "text-white",
                  activeClass: "border-white/60 bg-white/5",
                },
                {
                  key: "GRANTED",
                  label: "Permitidos",
                  value: grantedCount,
                  valueClass: "text-green-400",
                  activeClass: "border-green-500/60 bg-green-500/10",
                },
                {
                  key: "DENIED",
                  label: "Denegados",
                  value: deniedCount,
                  valueClass: "text-brand-red",
                  activeClass: "border-brand-red/60 bg-brand-red/10",
                },
                {
                  key: "PENDING",
                  label: "Pendientes",
                  value: pendingCount,
                  valueClass: "text-yellow-400",
                  activeClass: "border-yellow-500/60 bg-yellow-500/10",
                },
              ] as const
            ).map((tile) => {
              const isActive = activeFilter === tile.key;
              return (
                <Link
                  key={tile.key}
                  href={filterHref(tile.key)}
                  aria-pressed={isActive}
                  className={[
                    "text-center px-4 py-2 border transition-colors duration-200",
                    isActive
                      ? tile.activeClass
                      : "border-line hover:border-edge hover:bg-white/[0.02]",
                  ].join(" ")}
                >
                  <p
                    className={`text-2xl font-heading font-black tabular-nums ${tile.valueClass}`}
                  >
                    {tile.value}
                  </p>
                  <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                    {tile.label}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">
          No hay ingresos en este estado.
        </p>
      ) : (
        <div className="border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel">
                {["Fecha", "Hora", "Nº socio", "Alumno", "Estado", "Quién decidió"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line hover:bg-hover transition-colors duration-200"
                >
                  <td className="px-4 py-3 text-gray-400 font-body">
                    {formatDateArg(row.date)}
                  </td>
                  <td className="px-4 py-3 text-gray-300 tabular-nums font-heading">
                    {formatTime(row.date)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 tabular-nums font-heading">
                    {formatMemberNumber(row.memberNumber)}
                  </td>
                  <td className="px-4 py-3 text-white font-heading font-bold">
                    {row.userName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 inline-block",
                        stateClasses(row.state),
                      ].join(" ")}
                    >
                      {stateLabel(row.state)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-body text-xs">
                    {row.decidedBy ?? "Automático"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function parseDemoIngresosFilter(value: string | undefined): StateFilter {
  if (value === "GRANTED" || value === "DENIED" || value === "PENDING") {
    return value;
  }
  return "all";
}
