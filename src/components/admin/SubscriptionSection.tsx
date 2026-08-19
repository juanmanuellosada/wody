"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  setGymPaymentExempt,
  cancelGymSubscription,
  syncGymSubscription,
} from "@/actions/super-admin/gym";

interface Props {
  gymId: string;
  gymName: string;
  trialEndsAt: string | null;
  mpSubscriptionStatus: string | null;
  mpPreapprovalId: string | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
}

function MpStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-white/5 text-gray-400 border border-edge">
        Sin suscripción
      </span>
    );
  }
  const styles: Record<string, string> = {
    authorized: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    cancelled: "bg-brand-red/10 text-brand-red border-brand-red/30",
    pending: "bg-white/5 text-gray-400 border-edge",
  };
  const cls = styles[status] ?? "bg-white/5 text-gray-400 border-edge";
  const label: Record<string, string> = {
    authorized: "Autorizada",
    paused: "Pausada",
    cancelled: "Cancelada",
    pending: "Pendiente",
  };
  return (
    <span className={`text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 border ${cls}`}>
      {label[status] ?? status}
    </span>
  );
}

export function SubscriptionSection({
  gymId,
  gymName,
  trialEndsAt,
  mpSubscriptionStatus,
  mpPreapprovalId,
  paymentExempt: initialExempt,
  paymentExemptReason: initialReason,
}: Props) {
  const router = useRouter();
  const [isExemptPending, startExemptTransition] = useTransition();
  const [isCancelPending, startCancelTransition] = useTransition();
  const [isSyncPending, startSyncTransition] = useTransition();

  const [exempt, setExempt] = useState(initialExempt);
  const [reason, setReason] = useState(initialReason ?? "");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  function handleSaveExempt() {
    startExemptTransition(async () => {
      const result = await setGymPaymentExempt(gymId, exempt, reason);
      if (result.success) {
        toast.success(exempt ? "Gym marcado como exento." : "Exención removida.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSyncSubscription() {
    startSyncTransition(async () => {
      const result = await syncGymSubscription(gymId);
      if (result.success) {
        toast.success("Estado sincronizado con Mercado Pago.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCancelSubscription() {
    startCancelTransition(async () => {
      const result = await cancelGymSubscription(gymId);
      if (result.success) {
        toast.success("Suscripción cancelada.");
        setCancelConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
        setCancelConfirmOpen(false);
      }
    });
  }

  const trialFormatted = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;

  return (
    <>
      <div className="border-t border-line pt-6 mt-6 max-w-2xl flex flex-col gap-5">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Suscripción y exención
        </p>

        {/* Read-only fields */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 py-2 border-b border-line">
            <span className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500">
              Trial finaliza
            </span>
            <span className="text-xs font-body text-gray-300">
              {trialFormatted ?? "—"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 py-2 border-b border-line">
            <span className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500">
              Estado MP
            </span>
            <MpStatusBadge status={mpSubscriptionStatus} />
          </div>

          <div className="flex items-start justify-between gap-4 py-2 border-b border-line">
            <span className="text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500 flex-shrink-0">
              Preapproval ID
            </span>
            {mpPreapprovalId ? (
              <a
                href={`https://www.mercadopago.com.ar/subscriptions/preapproval/${mpPreapprovalId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-brand-red hover:underline truncate max-w-[60%]"
              >
                {mpPreapprovalId}
              </a>
            ) : (
              <span className="text-xs text-gray-600 font-body">—</span>
            )}
          </div>
        </div>

        {/* Sync with MP */}
        {mpPreapprovalId && (
          <div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={isSyncPending}
              onClick={handleSyncSubscription}
            >
              Sincronizar con Mercado Pago
            </Button>
            <p className="text-xs text-gray-600 font-body mt-2">
              Vuelve a leer el estado y la fecha de próximo cobro desde Mercado Pago.
            </p>
          </div>
        )}

        {/* Exemption toggle */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={exempt}
              onChange={(e) => {
                setExempt(e.target.checked);
                if (!e.target.checked) setReason("");
              }}
              className="w-4 h-4 accent-brand-red"
            />
            <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Exento de pago
            </span>
          </label>
          {exempt && (
            <Input
              label="Motivo de exención"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Ej: Gym pre-existente al lanzamiento del modelo de cobro"
            />
          )}
          <Button
            type="button"
            size="sm"
            loading={isExemptPending}
            onClick={handleSaveExempt}
          >
            Guardar exención
          </Button>
        </div>

        {/* Cancel subscription */}
        {mpPreapprovalId && (
          <div className="pt-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={isCancelPending}
              onClick={() => setCancelConfirmOpen(true)}
            >
              Cancelar suscripción
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancelar suscripción"
        message={`¿Cancelar la suscripción de "${gymName}" en Mercado Pago? Esta acción no se puede deshacer desde Wody.`}
        confirmLabel="Cancelar suscripción"
        variant="danger"
        loading={isCancelPending}
        onConfirm={handleCancelSubscription}
        onCancel={() => setCancelConfirmOpen(false)}
      />
    </>
  );
}
