"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MpCardForm } from "@/components/billing/MpCardForm";
import { cancelMySubscription, subscribePersonal } from "@/actions/personal-billing";

interface Props {
  trialEndsAt: Date | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  mpSubscriptionStatus: string | null;
  mpPreapprovalId: string | null;
  daysLeftInTrial: number | null;
  payerEmail?: string;
}

function trialHeadline(daysLeft: number | null): string {
  if (daysLeft === null) return "Tu suscripción";
  if (daysLeft > 1) return `Tu trial termina en ${daysLeft} días`;
  if (daysLeft === 1) return "Tu trial termina mañana";
  if (daysLeft === 0) return "Tu trial termina hoy";
  return `Tu trial venció hace ${-daysLeft} días`;
}

export function PersonalBillingPage({
  trialEndsAt,
  paymentExempt,
  paymentExemptReason,
  mpSubscriptionStatus,
  mpPreapprovalId,
  daysLeftInTrial,
  payerEmail,
}: Props) {
  const router = useRouter();
  const [isCancelPending, startCancelTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  const isAuthorized = mpSubscriptionStatus === "authorized";
  const isPausedOrCancelled =
    mpPreapprovalId !== null &&
    (mpSubscriptionStatus === "paused" || mpSubscriptionStatus === "cancelled");

  const trialFormatted = trialEndsAt
    ? trialEndsAt.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;

  function handleCancel() {
    startCancelTransition(async () => {
      const result = await cancelMySubscription();
      setCancelOpen(false);
      if (result.success) {
        toast.success("Suscripción cancelada.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleToken(cardTokenId: string, email: string) {
    const result = await subscribePersonal({ cardTokenId, payerEmail: email || payerEmail || "" });
    if (!result.success) {
      throw new Error(result.error);
    }
    toast.success("Suscripción configurada. El cobro se realizará al finalizar tu trial.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Mi cuenta
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Suscripción
        </h1>
      </div>

      {/* Case 1: Exempt */}
      {paymentExempt && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle
              size={20}
              className="text-emerald-400 flex-shrink-0"
              aria-hidden="true"
            />
            <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-emerald-400">
              Tu cuenta está exenta del cobro de Wody Personal
            </p>
          </div>
          {paymentExemptReason && (
            <p className="text-xs text-gray-500 font-body pl-8">
              {paymentExemptReason}
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
      {!paymentExempt && isAuthorized && (
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

          <div className="pt-2 border-t border-line">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setCancelOpen(true)}
              disabled={isCancelPending}
            >
              Cancelar suscripción
            </Button>
          </div>
        </div>
      )}

      {/* Case 2: Trial or no active sub — show card form */}
      {!paymentExempt && !isAuthorized && (
        <div className="border border-line bg-panel p-6 flex flex-col gap-5">
          {isPausedOrCancelled && (
            <div className="flex items-center gap-2.5 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-yellow-300">
                Suscripción {mpSubscriptionStatus === "paused" ? "pausada" : "cancelada"} — configurá una nueva tarjeta
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-heading font-black uppercase tracking-[0.1em] text-white">
              {trialHeadline(daysLeftInTrial)}
            </h2>
            {trialFormatted && (
              <p className="text-xs text-gray-500 font-body">
                Vence el {trialFormatted}
              </p>
            )}
          </div>

          <div className="border-t border-line pt-4">
            <p className="text-sm text-gray-400 font-body">
              <span className="text-white font-bold">$7.000 ARS por mes.</span>{" "}
              Podés cancelar en cualquier momento.
            </p>
          </div>

          <MpCardForm
            onToken={handleToken}
            payerEmail={payerEmail}
            monthlyAmountLabel="$7.000 ARS/mes"
            chargeHint="Podés configurar tu tarjeta en cualquier momento durante el trial. El cobro se realiza recién al finalizar el período de prueba."
          />
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar suscripción"
        message="¿Estás seguro? Vas a perder el acceso pagado al final del período cobrado actual. Podés volver a suscribirte cuando quieras."
        confirmLabel="Cancelar suscripción"
        variant="danger"
        loading={isCancelPending}
        onConfirm={handleCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
