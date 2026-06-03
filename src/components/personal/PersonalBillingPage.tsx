"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cancelMySubscription, subscribePersonal } from "@/actions/personal-billing";

interface Props {
  trialEndsAt: Date | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  mpSubscriptionStatus: string | null;
  mpPreapprovalId: string | null;
  daysLeftInTrial: number | null;
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
}: Props) {
  const router = useRouter();
  const [isCancelPending, startCancelTransition] = useTransition();
  const [isSubscribePending, startSubscribeTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

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

  function handleSubscribe() {
    setSubscribeError(null);
    startSubscribeTransition(async () => {
      const result = await subscribePersonal();
      if (!result.success) {
        setSubscribeError(result.error);
        return;
      }
      window.location.href = result.initPoint;
    });
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

      {/* Case 2: Trial or no active sub — show subscribe button */}
      {!paymentExempt && !isAuthorized && (
        <div className="border border-line bg-panel p-6 flex flex-col gap-5">
          {isPausedOrCancelled && (
            <div className="flex items-center gap-2.5 border border-yellow-500/30 bg-yellow-500/5 px-4 py-2.5">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-yellow-300">
                Suscripción {mpSubscriptionStatus === "paused" ? "pausada" : "cancelada"} — suscribite nuevamente
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

          <div className="flex flex-col gap-3">
            {subscribeError && (
              <div className="flex items-start gap-2.5 border border-brand-red/30 bg-brand-red/5 px-4 py-3">
                <AlertTriangle size={14} className="text-brand-red flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs font-body text-red-400">{subscribeError}</p>
              </div>
            )}

            <button
              type="button"
              disabled={isSubscribePending}
              onClick={handleSubscribe}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-red text-white text-sm font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200 w-full sm:w-fit disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubscribePending ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Preparando...
                </>
              ) : (
                <>
                  <ExternalLink size={16} aria-hidden="true" />
                  Suscribirme — $7.000 ARS/mes
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 font-body">
              Serás redirigido a Mercado Pago para autorizar el débito automático. El cobro se realiza recién al finalizar el período de prueba.
            </p>
          </div>
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
