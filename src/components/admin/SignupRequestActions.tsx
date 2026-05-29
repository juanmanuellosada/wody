"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  approveSignupRequest,
  rejectSignupRequest,
  resendOnboardingEmail,
} from "@/actions/super-admin/signup-request";
import type { SignupRequestStatus } from "@prisma/client";

interface Props {
  id: string;
  status: SignupRequestStatus;
  tokenExpiresAt: string | null;
}

export function SignupRequestActions({ id, status, tokenExpiresAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const tokenExpired =
    !tokenExpiresAt || new Date(tokenExpiresAt) < new Date();

  function handleApprove() {
    startTransition(async () => {
      const result = await approveSignupRequest(id);
      setApproveOpen(false);
      if (result.success) {
        toast.success("Solicitud aprobada. Se envió el email al lead.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectSignupRequest(id, rejectionReason || undefined);
      setRejectOpen(false);
      setRejectionReason("");
      if (result.success) {
        toast.success("Solicitud rechazada. Se envió email al lead.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleResend() {
    startTransition(async () => {
      const result = await resendOnboardingEmail(id);
      setResendOpen(false);
      if (result.success) {
        toast.success("Email de onboarding reenviado.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (status === "REJECTED" || status === "COMPLETED") {
    return (
      <div className="border border-line bg-panel p-5">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
          {status === "COMPLETED"
            ? "Este gym ya completó el onboarding. No hay acciones disponibles."
            : "Esta solicitud fue rechazada. No hay acciones disponibles."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-line bg-panel p-5 flex flex-col gap-4">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Acciones
        </p>

        <div className="flex flex-wrap gap-3">
          {/* PENDING: Aprobar + Rechazar */}
          {status === "PENDING" && (
            <>
              <Button
                size="sm"
                onClick={() => setApproveOpen(true)}
                disabled={isPending}
              >
                Aprobar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRejectOpen(true)}
                disabled={isPending}
              >
                Rechazar
              </Button>
            </>
          )}

          {/* APPROVED con token vigente: Re-emitir email + Rechazar */}
          {status === "APPROVED" && !tokenExpired && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setResendOpen(true)}
                disabled={isPending}
              >
                Re-emitir email
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRejectOpen(true)}
                disabled={isPending}
              >
                Rechazar
              </Button>
            </>
          )}

          {/* APPROVED con token expirado: Re-aprobar + Rechazar */}
          {status === "APPROVED" && tokenExpired && (
            <>
              <Button
                size="sm"
                onClick={() => setApproveOpen(true)}
                disabled={isPending}
              >
                Re-aprobar (token nuevo)
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRejectOpen(true)}
                disabled={isPending}
              >
                Rechazar
              </Button>
            </>
          )}

          {/* EXPIRED: Re-aprobar */}
          {status === "EXPIRED" && (
            <Button
              size="sm"
              onClick={() => setApproveOpen(true)}
              disabled={isPending}
            >
              Re-aprobar (token nuevo)
            </Button>
          )}
        </div>
      </div>

      {/* Confirm: Aprobar / Re-aprobar */}
      <ConfirmDialog
        open={approveOpen}
        title={status === "PENDING" ? "Aprobar solicitud" : "Re-aprobar solicitud"}
        message={
          status === "PENDING"
            ? "Se generará un token de onboarding y se enviará el email al lead. ¿Continuar?"
            : "Se generará un nuevo token de onboarding y se enviará el email al lead. ¿Continuar?"
        }
        confirmLabel={status === "PENDING" ? "Aprobar" : "Re-aprobar"}
        loading={isPending}
        onConfirm={handleApprove}
        onCancel={() => setApproveOpen(false)}
      />

      {/* Confirm: Re-emitir email */}
      <ConfirmDialog
        open={resendOpen}
        title="Re-emitir email de onboarding"
        message="Se reenviará el mismo email con el link de onboarding actual. ¿Continuar?"
        confirmLabel="Re-emitir"
        loading={isPending}
        onConfirm={handleResend}
        onCancel={() => setResendOpen(false)}
      />

      {/* Modal: Rechazar con motivo opcional */}
      {rejectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setRejectOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-panel border border-line p-6 flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
            aria-label="Rechazar solicitud"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
                Rechazar solicitud
              </h2>
              <button
                onClick={() => { setRejectOpen(false); setRejectionReason(""); }}
                disabled={isPending}
                className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cerrar"
              >
                &#215;
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="rejection-reason"
                className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
              >
                Motivo (opcional)
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Ej: No cumple los criterios de uso..."
                disabled={isPending}
                className="bg-elev text-white font-body w-full border border-edge px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200 resize-none"
              />
              <p className="text-xs text-gray-600 font-body">
                Se incluirá en el email enviado al lead si se completa.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setRejectOpen(false); setRejectionReason(""); }}
                disabled={isPending}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={isPending}
                onClick={handleReject}
                className="flex-1"
              >
                Rechazar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
