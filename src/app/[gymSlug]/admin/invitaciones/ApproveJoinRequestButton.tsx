"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { approveJoinRequest } from "@/actions/join-request";

interface Props {
  requestId: string;
  requestName: string;
  requestEmail: string;
}

export function ApproveJoinRequestButton({ requestId, requestName, requestEmail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const result = await approveJoinRequest({ requestId });
      setOpen(false);
      if (result.ok) {
        router.refresh();
      } else {
        setFeedback({ ok: false, msg: result.error });
        setTimeout(() => setFeedback(null), 5000);
      }
    });
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)} loading={isPending}>
        Aprobar
      </Button>

      {feedback && !feedback.ok && (
        <span
          className="text-xs font-heading font-bold uppercase tracking-wide px-2 py-1 text-brand-red"
          role="alert"
        >
          {feedback.msg}
        </span>
      )}

      <ConfirmDialog
        open={open}
        title="Aprobar solicitud"
        message={`Vas a crear el alumno ${requestName} (${requestEmail}). Le va a llegar un mail cuando la cuenta sea aprobada.`}
        confirmLabel="Aprobar"
        variant="primary"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
