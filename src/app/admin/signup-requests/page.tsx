import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listSignupRequests } from "@/actions/super-admin/signup-request";
import type { SignupRequestStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<SignupRequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  COMPLETED: "Completada",
  EXPIRED: "Expirada",
};

const STATUS_STYLES: Record<SignupRequestStatus, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-brand-red/10 text-brand-red border-brand-red/30",
  COMPLETED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  EXPIRED: "bg-white/5 text-gray-500 border-edge",
};

const ALL_STATUSES: SignupRequestStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "EXPIRED",
];

function StatusBadge({ status }: { status: SignupRequestStatus }) {
  return (
    <span
      className={`text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 border ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function SignupRequestsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    redirect("/");
  }

  const { status: statusParam } = await searchParams;
  const activeFilter = ALL_STATUSES.includes(statusParam as SignupRequestStatus)
    ? (statusParam as SignupRequestStatus)
    : undefined;

  const rows = await listSignupRequests(
    activeFilter ? { status: activeFilter } : undefined
  );

  // Sort: PENDING first, then by createdAt desc
  const sorted = [...rows].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (b.status === "PENDING" && a.status !== "PENDING") return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
            Super Admin
          </p>
          <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white flex items-center gap-3">
            Leads
            {pendingCount > 0 && (
              <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] px-2 py-0.5 bg-brand-red text-white">
                {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 font-body mt-1">
            {rows.length} solicitude{rows.length !== 1 ? "s" : ""}
            {activeFilter ? ` · filtro: ${STATUS_LABELS[activeFilter]}` : ""}
          </p>
        </div>
        <Link
          href="/admin/signup-requests/new"
          className="px-5 py-2.5 bg-brand-red text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200"
        >
          + Agregar whitelist
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-4">
        <Link
          href="/admin/signup-requests"
          className={[
            "px-4 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 border",
            !activeFilter
              ? "bg-brand-red text-white border-brand-red"
              : "bg-elev text-gray-400 border-edge hover:border-brand-red hover:text-white",
          ].join(" ")}
        >
          Todos
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/signup-requests?status=${s}`}
            className={[
              "px-4 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 border",
              activeFilter === s
                ? "bg-brand-red text-white border-brand-red"
                : "bg-elev text-gray-400 border-edge hover:border-brand-red hover:text-white",
            ].join(" ")}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel">
              {["Email", "Contacto", "Gym", "Tipo", "Estado", "Fecha", ""].map((h) => (
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
            {sorted.map((req) => (
              <tr
                key={req.id}
                className="border-b border-line hover:bg-hover transition-colors duration-200"
              >
                <td className="px-4 py-3.5 text-gray-300 font-body text-xs">
                  {req.email}
                </td>
                <td className="px-4 py-3.5 text-gray-300 font-body text-xs">
                  {req.contactName}
                </td>
                <td className="px-4 py-3.5 font-body text-xs">
                  <Link
                    href={`/admin/signup-requests/${req.id}`}
                    className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
                  >
                    {req.gymName ?? req.contactName}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-gray-500 font-body text-xs">
                  {req.gymKindSuggested === "BOX" ? "Box" : req.gymKindSuggested === "GYM" ? "Gym" : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={req.status} />
                </td>
                <td className="px-4 py-3.5 text-gray-500 font-body text-xs tabular-nums">
                  {req.createdAt.toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "America/Argentina/Buenos_Aires",
                  })}
                </td>
                <td className="px-4 py-3.5">
                  <Link
                    href={`/admin/signup-requests/${req.id}`}
                    className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400 hover:text-white transition-colors duration-200 px-3 py-1.5 border border-edge hover:border-brand-red"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-600 font-body text-xs"
                >
                  No hay solicitudes
                  {activeFilter ? ` con estado ${STATUS_LABELS[activeFilter]}` : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
