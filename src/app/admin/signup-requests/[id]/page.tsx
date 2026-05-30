import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getSignupRequestDetail } from "@/actions/super-admin/signup-request";
import { SignupRequestActions } from "@/components/admin/SignupRequestActions";
import type { SignupRequestStatus, SignupRequestType } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<SignupRequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  COMPLETED: "Completada",
  EXPIRED: "Expirada",
};

const TYPE_LABELS: Record<SignupRequestType, string> = {
  GYM: "Gym / Box",
  PERSONAL: "Wody Personal",
};

const TYPE_STYLES: Record<SignupRequestType, string> = {
  GYM: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  PERSONAL: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const STATUS_STYLES: Record<SignupRequestStatus, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-brand-red/10 text-brand-red border-brand-red/30",
  COMPLETED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  EXPIRED: "bg-white/5 text-gray-500 border-edge",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-line">
      <span className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500 flex-shrink-0">
        {label}
      </span>
      <span className="text-xs font-body text-gray-300 text-right break-all">{children}</span>
    </div>
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SignupRequestDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPERADMIN") {
    redirect("/");
  }

  const { id } = await params;

  let req;
  try {
    req = await getSignupRequestDetail(id);
  } catch {
    notFound();
  }

  const formatDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString("es-AR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        })
      : "—";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Breadcrumb + header */}
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          <Link href="/admin/signup-requests" className="hover:underline">
            Leads
          </Link>
          {" / "}Detalle
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          {req.gymName ?? req.contactName}
        </h1>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 border ${TYPE_STYLES[req.type]}`}
          >
            {TYPE_LABELS[req.type]}
          </span>
          <span
            className={`text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 border ${STATUS_STYLES[req.status]}`}
          >
            {STATUS_LABELS[req.status]}
          </span>
        </div>
      </div>

      {/* Fields */}
      <div className="border border-line bg-panel p-5 flex flex-col gap-0">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">
          Datos del lead
        </p>
        <Field label="Email">{req.email}</Field>
        <Field label="Contacto">{req.contactName}</Field>
        {req.type === "GYM" && req.gymName && <Field label="Gym">{req.gymName}</Field>}
        {req.type === "GYM" && req.gymKindSuggested && (
          <Field label="Tipo centro">{req.gymKindSuggested === "BOX" ? "Box (CrossFit)" : "Gym (tradicional)"}</Field>
        )}
        {req.phone && <Field label="Teléfono">{req.phone}</Field>}
        {req.type === "GYM" && req.expectedStudents != null && (
          <Field label="Alumnos esperados">{req.expectedStudents}</Field>
        )}
        {req.message && <Field label="Mensaje">{req.message}</Field>}
        {req.createdByAdminId && (
          <Field label="Origen">
            <span className="text-yellow-400">Creado vía whitelist</span>
          </Field>
        )}
      </div>

      {/* Timestamps */}
      <div className="border border-line bg-panel p-5 flex flex-col gap-0">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">
          Historial
        </p>
        <Field label="Creada">{formatDate(req.createdAt)}</Field>
        <Field label="Aprobada">{formatDate(req.approvedAt)}</Field>
        {req.type === "GYM" && (
          <Field label="Token expira">{formatDate(req.tokenExpiresAt)}</Field>
        )}
        {req.rejectedAt && <Field label="Rechazada">{formatDate(req.rejectedAt)}</Field>}
        {req.rejectionReason && <Field label="Motivo rechazo">{req.rejectionReason}</Field>}
        {req.completedAt && <Field label="Completada">{formatDate(req.completedAt)}</Field>}
        {req.gymId && (
          <Field label="Gym creado">
            <Link
              href={`/admin/gyms/${req.gymId}`}
              className="text-brand-red hover:underline"
            >
              Ver gym →
            </Link>
          </Field>
        )}
      </div>

      {/* Actions */}
      <SignupRequestActions
        id={req.id}
        status={req.status}
        type={req.type}
        tokenExpiresAt={req.tokenExpiresAt ? req.tokenExpiresAt.toISOString() : null}
      />
    </div>
  );
}
