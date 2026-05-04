import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath, isPersonalGym } from "@/lib/gym";
import type { Metadata } from "next";
import { JoinLinkBox } from "./JoinLinkBox";
import { ApproveJoinRequestButton } from "./ApproveJoinRequestButton";
import { RejectJoinRequestButton } from "./RejectJoinRequestButton";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gymSlug } = await params;
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug }, select: { name: true } });
  return { title: `Invitaciones — ${gym?.name ?? "WODY"}` };
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export default async function InvitacionesPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const { tab: tabParam } = await searchParams;

  const session = await auth();

  if (session?.user && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (!session?.user || session.user.role !== "ADMIN" || session.user.gymSlug !== gymSlug) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug }, select: { id: true, name: true } });
  if (!gym) notFound();

  // Fetch active teachers/admins for the edit-before-approve form.
  const teachers = await prisma.user.findMany({
    where: {
      gymId: gym.id,
      deletedAt: null,
      role: { in: ["TEACHER", "ADMIN"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const tab: "pending" | "approved" | "rejected" =
    tabParam === "approved" ? "approved" :
    tabParam === "rejected" ? "rejected" :
    "pending";

  const statusFilter =
    tab === "approved" ? "APPROVED" :
    tab === "rejected" ? "REJECTED" :
    "PENDING";

  const requests = await prisma.joinRequest.findMany({
    where: { gymId: gym.id, status: statusFilter },
    include: {
      teachers: { include: { teacher: { select: { id: true, name: true } } } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const tabClass = (active: boolean) =>
    active
      ? "px-4 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] border-b-2 border-brand-red text-white"
      : "px-4 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] border-b-2 border-transparent text-gray-500 hover:text-gray-300 transition-colors duration-200";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Panel de Control
        </p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Invitaciones
        </h1>
      </div>

      {/* Public link box */}
      <JoinLinkBox gymSlug={gymSlug} />

      {/* Tabs */}
      <div className="border border-line bg-panel">
        <nav
          className="flex border-b border-line px-2"
          aria-label="Filtro por estado"
        >
          <Link href={`?tab=pending`} className={tabClass(tab === "pending")}>
            Pendientes
          </Link>
          <Link href={`?tab=approved`} className={tabClass(tab === "approved")}>
            Aprobadas
          </Link>
          <Link href={`?tab=rejected`} className={tabClass(tab === "rejected")}>
            Rechazadas
          </Link>
        </nav>

        {/* List */}
        {requests.length === 0 ? (
          <p className="text-center py-10 text-sm text-gray-500 font-heading">
            No hay solicitudes en esta categoría.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {requests.map((req) => (
              <li key={req.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-hover transition-colors duration-200">
                {/* Info */}
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-heading font-bold text-white">{req.name}</p>
                  <p className="text-xs text-gray-400 font-body">{req.email}</p>
                  {req.teachers.length > 0 && (
                    <p className="text-xs text-gray-500 font-heading">
                      Profe{req.teachers.length > 1 ? "s" : ""}: {req.teachers.map((jt) => jt.teacher.name).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 font-heading mt-0.5">
                    Solicitada: {formatDate(req.createdAt)}
                  </p>
                  {req.reviewedAt && req.reviewedBy && (
                    <p className="text-xs text-gray-600 font-heading">
                      {tab === "approved" ? "Aprobada" : "Rechazada"} por{" "}
                      {req.reviewedBy.name} el {formatDate(req.reviewedAt)}
                    </p>
                  )}
                </div>

                {/* Actions (only for pending) */}
                {tab === "pending" && (
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    <ApproveJoinRequestButton
                      requestId={req.id}
                      requestName={req.name}
                      requestEmail={req.email}
                      requestTeacherIds={req.teachers.map((jt) => jt.teacher.id)}
                      teachers={teachers}
                    />
                    <RejectJoinRequestButton
                      requestId={req.id}
                      requestName={req.name}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
