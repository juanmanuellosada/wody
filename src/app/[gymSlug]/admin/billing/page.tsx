import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { auth } from "@/lib/auth";
import { gymPath } from "@/lib/gym";
import { getMySubscriptionStatus } from "@/actions/billing";
import { GymCardFormSection } from "./GymCardFormSection";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export const dynamic = "force-dynamic";

export default async function BillingPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(gymPath(gymSlug, "/login"));
  }

  const status = await getMySubscriptionStatus();

  const trialFormatted = status.trialEndsAt
    ? status.trialEndsAt.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;

  const daysLeft = status.daysLeftInTrial;

  function trialHeadline(): string {
    if (daysLeft === null) return "Tu suscripción";
    if (daysLeft > 1) return `Tu trial termina en ${daysLeft} días`;
    if (daysLeft === 1) return "Tu trial termina mañana";
    if (daysLeft === 0) return "Tu trial termina hoy";
    return `Tu trial venció hace ${-daysLeft} días`;
  }

  const isAuthorized = status.mpSubscriptionStatus === "authorized";
  const isPausedOrCancelled =
    status.mpPreapprovalId !== null &&
    (status.mpSubscriptionStatus === "paused" || status.mpSubscriptionStatus === "cancelled");

  // Show card form when: not exempt AND (not authorized, OR paused/cancelled wanting to retry)
  const showCardForm = !status.paymentExempt && !isAuthorized;

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Configuración
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Suscripción
        </h1>
      </div>

      {/* Case 1: Exempt */}
      {status.paymentExempt && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle
              size={20}
              className="text-emerald-400 flex-shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-emerald-400">
              Tu gym está exento del cobro de Wody
            </p>
          </div>
          {status.mpPreapprovalId === null && status.paymentExempt && (
            <p className="text-xs text-gray-500 font-body pl-8">
              No se te cobrará ningún monto por el uso de la plataforma.
            </p>
          )}
          <div className="pl-8">
            <a
              href="mailto:soporte@wody.app"
              className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-white transition-colors duration-200"
            >
              ¿Tenés una consulta? Contactanos
            </a>
          </div>
        </div>
      )}

      {/* Case 3: Authorized subscription */}
      {!status.paymentExempt && isAuthorized && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle
                size={20}
                className="text-emerald-400 flex-shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
                Tu suscripción está activa
              </p>
            </div>
            <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Activa
            </span>
          </div>
          <p className="text-xs text-gray-500 font-body">
            Para cancelar tu suscripción, contactanos.
          </p>
        </div>
      )}

      {/* Case 2: Trial or paused/cancelled — show card form */}
      {showCardForm && (
        <div className="border border-line bg-panel p-6 flex flex-col gap-5">
          {isPausedOrCancelled && (
            <div className="flex items-center gap-2.5 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-yellow-300">
                Suscripción {status.mpSubscriptionStatus === "paused" ? "pausada" : "cancelada"} — configurá una nueva tarjeta
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-heading font-black uppercase tracking-[0.1em] text-white">
              {trialHeadline()}
            </h2>
            {trialFormatted && (
              <p className="text-xs text-gray-500 font-body">
                Vence el {trialFormatted}
              </p>
            )}
          </div>

          <div className="border-t border-line pt-4">
            <p className="text-sm text-gray-400 font-body">
              <span className="text-white font-bold">$40.000 ARS por mes.</span>{" "}
              Podés cancelar en cualquier momento contactándonos.
            </p>
          </div>

          <GymCardFormSection payerEmail={session.user.email ?? ""} />
        </div>
      )}

      <div className="border-t border-line pt-4">
        <Link
          href={gymPath(gymSlug, "/admin")}
          className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white transition-colors duration-200"
        >
          ← Volver al panel
        </Link>
      </div>
    </div>
  );
}
