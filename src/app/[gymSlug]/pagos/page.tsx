import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { formatDateArg, getTodayArgentina } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { PayButton } from "@/components/PayButton";
import { EditStudentButton } from "@/components/EditStudentButton";
import { BlockUserButton } from "@/components/BlockUserButton";
import { getBlockStatus } from "@/lib/blocking";

type StatusFilter = "all" | "overdue" | "due-soon" | "ok";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ status?: string }>;
}

function parseFilter(value: string | undefined): StatusFilter {
  if (value === "overdue" || value === "due-soon" || value === "ok") {
    return value;
  }
  return "all";
}

type PaymentRow = {
  id: string;
  name: string;
  email: string;
  nextPaymentDate: Date;
  blockedAt: Date | null;
  studentType: import("@prisma/client").StudentType;
  canCreateOwnRoutines: boolean;
  assignedTeachers: { id: string; name: string }[];
};

type Status =
  | { kind: "overdue"; days: number }
  | { kind: "due-soon"; days: number }
  | { kind: "ok"; days: number };

function computeStatus(date: Date, today: Date): Status {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (date.getTime() - today.getTime()) / msPerDay
  );
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

export default async function PaymentsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const { status: statusParam } = await searchParams;
  const activeFilter = parseFilter(statusParam);
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const gymId = session.user.gymId;
  const isAdmin = session.user.role === "ADMIN";

  const [students, teacherLinks, teachers, gymConfig] = await Promise.all([
    isAdmin
      ? prisma.user.findMany({
          where: { gymId, role: "STUDENT", deletedAt: null },
          orderBy: { nextPaymentDate: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            nextPaymentDate: true,
            blockedAt: true,
            studentType: true,
            canCreateOwnRoutines: true,
          },
        })
      : prisma.user.findMany({
          where: {
            gymId,
            role: "STUDENT",
            deletedAt: null,
            studentOf: { some: { teacherId: session.user.id } },
          },
          orderBy: { nextPaymentDate: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            nextPaymentDate: true,
            blockedAt: true,
            studentType: true,
            canCreateOwnRoutines: true,
          },
        }),
    prisma.teacherStudent.findMany({
      where: { teacher: { gymId } },
      select: { teacherId: true, studentId: true },
    }),
    prisma.user.findMany({
      where: { gymId, deletedAt: null, OR: [{ role: "TEACHER" }, { role: "ADMIN" }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.gym.findUnique({
      where: { id: gymId },
      select: { autoBlockAfterDays: true },
    }),
  ]);

  const autoBlockAfterDays = gymConfig?.autoBlockAfterDays ?? 5;

  const teachersById = new Map(teachers.map((t) => [t.id, t]));
  const teachersByStudentId = new Map<string, { id: string; name: string }[]>();
  for (const link of teacherLinks) {
    const teacher = teachersById.get(link.teacherId);
    if (!teacher) continue;
    const list = teachersByStudentId.get(link.studentId) ?? [];
    list.push(teacher);
    teachersByStudentId.set(link.studentId, list);
  }

  const today = getTodayArgentina();
  const rows: PaymentRow[] = students.map((s) => ({
    ...s,
    assignedTeachers: teachersByStudentId.get(s.id) ?? [],
  }));

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

  const basePath = gymPath(gymSlug, "/pagos");
  const filterHref = (f: StatusFilter) =>
    f === "all" ? basePath : `${basePath}?status=${f}`;

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
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
                  aria-current={isActive ? "page" : undefined}
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

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">
          {isAdmin
            ? "No hay alumnos cargados todavía."
            : "No tenés alumnos asignados."}
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">
          No hay alumnos en este estado.
        </p>
      ) : (
        <>
          {/* Desktop table */}
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
                  const blockStatus = getBlockStatus(
                    {
                      role: "STUDENT",
                      blockedAt: row.blockedAt,
                      nextPaymentDate: row.nextPaymentDate,
                    },
                    autoBlockAfterDays
                  );
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
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={[
                              "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 inline-block",
                              statusClasses(status),
                            ].join(" ")}
                          >
                            {statusLabel(status)}
                          </span>
                          {blockStatus.blocked && (
                            <span
                              className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 inline-block bg-brand-red/15 text-brand-red border border-brand-red/30"
                              title={
                                blockStatus.kind === "overdue"
                                  ? `Auto-bloqueado: ${blockStatus.days} días de atraso`
                                  : "Bloqueado manualmente"
                              }
                            >
                              {blockStatus.kind === "overdue" ? "Auto-bloq." : "Bloqueado"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <PayButton
                            studentId={row.id}
                            studentName={row.name}
                          />
                          <EditStudentButton
                            studentId={row.id}
                            name={row.name}
                            email={row.email}
                            nextPaymentDate={row.nextPaymentDate}
                            blocked={row.blockedAt !== null}
                            studentType={row.studentType}
                            canCreateOwnRoutines={row.canCreateOwnRoutines}
                            assignedTeachers={row.assignedTeachers}
                            allTeachers={teachers}
                          />
                          {isAdmin && (
                            <BlockUserButton
                              userId={row.id}
                              currentUserId={session.user.id}
                              userRole="STUDENT"
                              blocked={row.blockedAt !== null}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col gap-3">
            {visibleRows.map((row) => {
              const status = computeStatus(row.nextPaymentDate, today);
              const blockStatus = getBlockStatus(
                {
                  role: "STUDENT",
                  blockedAt: row.blockedAt,
                  nextPaymentDate: row.nextPaymentDate,
                },
                autoBlockAfterDays
              );
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
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <span
                          className={[
                            "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5",
                            statusClasses(status),
                          ].join(" ")}
                        >
                          {statusLabel(status)}
                        </span>
                        {blockStatus.blocked && (
                          <span
                            className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-brand-red/15 text-brand-red border border-brand-red/30"
                            title={
                              blockStatus.kind === "overdue"
                                ? `Auto-bloqueado: ${blockStatus.days} días de atraso`
                                : "Bloqueado manualmente"
                            }
                          >
                            {blockStatus.kind === "overdue" ? "Auto-bloq." : "Bloqueado"}
                          </span>
                        )}
                      </div>
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
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <PayButton
                          studentId={row.id}
                          studentName={row.name}
                        />
                        <EditStudentButton
                          studentId={row.id}
                          name={row.name}
                          email={row.email}
                          nextPaymentDate={row.nextPaymentDate}
                          blocked={row.blockedAt !== null}
                          studentType={row.studentType}
                          canCreateOwnRoutines={row.canCreateOwnRoutines}
                          assignedTeachers={row.assignedTeachers}
                          allTeachers={teachers}
                        />
                        {isAdmin && (
                          <BlockUserButton
                            userId={row.id}
                            currentUserId={session.user.id}
                            userRole="STUDENT"
                            blocked={row.blockedAt !== null}
                          />
                        )}
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
