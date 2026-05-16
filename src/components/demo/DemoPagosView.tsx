import Link from "next/link";
import { formatDateArg, getTodayArgentina, addOneMonth, toInputDate } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { EditStudentButton } from "@/components/EditStudentButton";
import { RegisterPaymentButton, RegisterPaymentRowButton } from "@/components/RegisterPaymentSection";
import type { PaymentStudent } from "@/components/RegisterPaymentDialog";

type StatusFilter = "all" | "overdue" | "due-soon" | "ok";

export type DemoPaymentRow = {
  id: string;
  name: string;
  email: string;
  nextPaymentDate: Date;
  assignedTeachers: { id: string; name: string }[];
};

type Status =
  | { kind: "overdue"; days: number }
  | { kind: "due-soon"; days: number }
  | { kind: "ok"; days: number };

function computeStatus(date: Date, today: Date): Status {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round((date.getTime() - today.getTime()) / msPerDay);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days <= 7) return { kind: "due-soon", days };
  return { kind: "ok", days };
}

function statusLabel(s: Status): string {
  if (s.kind === "overdue") {
    return s.days === 1 ? "Atrasado 1 día" : `Atrasado ${s.days} días`;
  }
  if (s.kind === "due-soon") {
    if (s.days === 0) return "Vence hoy";
    return s.days === 1 ? "Vence mañana" : `Vence en ${s.days} días`;
  }
  return "Al día";
}

function statusClasses(s: Status): string {
  if (s.kind === "overdue") {
    return "bg-brand-red/15 text-brand-red border border-brand-red/30";
  }
  if (s.kind === "due-soon") {
    return "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";
  }
  return "bg-green-500/10 text-green-400 border border-green-500/20";
}

interface Props {
  rows: DemoPaymentRow[];
  allTeachers: { id: string; name: string }[];
  basePath: string;
  activeFilter: StatusFilter;
  emptyMessage: string;
}

export function DemoPagosView({
  rows,
  allTeachers,
  basePath,
  activeFilter,
  emptyMessage,
}: Props) {
  const today = getTodayArgentina();

  const overdueCount = rows.filter(
    (r) => computeStatus(r.nextPaymentDate, today).kind === "overdue"
  ).length;
  const dueSoonCount = rows.filter(
    (r) => computeStatus(r.nextPaymentDate, today).kind === "due-soon"
  ).length;
  const okCount = rows.length - overdueCount - dueSoonCount;

  const visibleRows =
    activeFilter === "all"
      ? rows
      : rows.filter(
          (r) => computeStatus(r.nextPaymentDate, today).kind === activeFilter
        );

  const filterHref = (f: StatusFilter) =>
    f === "all" ? basePath : `${basePath}?status=${f}`;

  // Demo payment students (no prior payments in demo, suggestedNextDate = nextPaymentDate + 1 month)
  const demoPaymentStudents: PaymentStudent[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    suggestedNextDate: toInputDate(addOneMonth(r.nextPaymentDate)),
    lastAmount: null,
  }));

  return (
    <div className="flex flex-col gap-10">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
              Control de Pagos
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Pagos
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
                  key: "overdue",
                  label: "Atrasados",
                  value: overdueCount,
                  valueClass: "text-brand-red",
                  activeClass: "border-brand-red/60 bg-brand-red/10",
                },
                {
                  key: "due-soon",
                  label: "Por vencer",
                  value: dueSoonCount,
                  valueClass: "text-yellow-400",
                  activeClass: "border-yellow-500/60 bg-yellow-500/10",
                },
                {
                  key: "ok",
                  label: "Al día",
                  value: okCount,
                  valueClass: "text-green-400",
                  activeClass: "border-green-500/60 bg-green-500/10",
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

      {/* Registrar pago button */}
      {rows.length > 0 && (
        <div className="flex justify-end">
          <RegisterPaymentButton students={demoPaymentStudents} demo />
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">{emptyMessage}</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">
          No hay alumnos en este estado.
        </p>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel">
                  {["Alumno", "Próximo pago", "Estado", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const status = computeStatus(row.nextPaymentDate, today);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-line hover:bg-hover transition-colors duration-200"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-white font-heading font-bold">
                            {row.name}
                          </span>
                          <span className="text-gray-500 text-xs font-body">
                            {row.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-300 font-heading font-bold">
                        {formatDateArg(row.nextPaymentDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={[
                            "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 inline-block",
                            statusClasses(status),
                          ].join(" ")}
                        >
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <RegisterPaymentRowButton
                            students={demoPaymentStudents}
                            studentId={row.id}
                            demo
                          />
                          <EditStudentButton
                            studentId={row.id}
                            name={row.name}
                            email={row.email}
                            nextPaymentDate={row.nextPaymentDate}
                            studentType="PERSONALIZED"
                            canCreateOwnRoutines={false}
                            assignedTeachers={row.assignedTeachers}
                            allTeachers={allTeachers}
                            demo
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden flex flex-col gap-3">
            {visibleRows.map((row) => {
              const status = computeStatus(row.nextPaymentDate, today);
              return (
                <Card key={row.id}>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-heading font-bold text-sm truncate">
                          {row.name}
                        </p>
                        <p className="text-gray-500 text-xs font-body truncate">
                          {row.email}
                        </p>
                      </div>
                      <span
                        className={[
                          "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 flex-shrink-0",
                          statusClasses(status),
                        ].join(" ")}
                      >
                        {statusLabel(status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                          Próximo pago
                        </span>
                        <span className="text-white font-heading font-bold text-sm">
                          {formatDateArg(row.nextPaymentDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <RegisterPaymentRowButton
                          students={demoPaymentStudents}
                          studentId={row.id}
                          demo
                        />
                        <EditStudentButton
                          studentId={row.id}
                          name={row.name}
                          email={row.email}
                          nextPaymentDate={row.nextPaymentDate}
                          studentType="PERSONALIZED"
                          canCreateOwnRoutines={false}
                          assignedTeachers={row.assignedTeachers}
                          allTeachers={allTeachers}
                          demo
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function parseDemoFilter(value: string | undefined): StatusFilter {
  if (value === "overdue" || value === "due-soon" || value === "ok") {
    return value;
  }
  return "all";
}
