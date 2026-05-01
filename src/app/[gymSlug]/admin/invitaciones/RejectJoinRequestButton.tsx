"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { rejectJoinRequest } from "@/actions/join-request";

interface Props {
  requestId: string;
  requestName: string;
}

export function RejectJoinRequestButton({ requestId, requestName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const result = await rejectJoinRequest({ requestId });
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
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} loading={isPending}>
        Rechazar
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
        title="Rechazar solicitud"
        message={`Vas a rechazar la solicitud de ${requestName}. No se le manda mail.`}
        confirmLabel="Rechazar"
        variant="danger"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
