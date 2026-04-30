"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { resendInvitation } from "@/actions/user";

interface ResendInvitationButtonProps {
  userId: string;
  userEmail: string;
}

export function ResendInvitationButton({ userId, userEmail }: ResendInvitationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const result = await resendInvitation(userId);
      setOpen(false);
      if (result.success) {
        setFeedback({ ok: true, msg: "Invitación reenviada." });
      } else {
        setFeedback({ ok: false, msg: result.error });
      }
      // Auto-clear feedback after 4 seconds
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        loading={isPending}
        title="Reenviar invitación"
      >
        Reenviar invitación
      </Button>

      {feedback && (
        <span
          className={[
            "text-xs font-heading font-bold uppercase tracking-wide px-2 py-1",
            feedback.ok
              ? "text-green-500"
              : "text-brand-red",
          ].join(" ")}
          role="status"
        >
          {feedback.msg}
        </span>
      )}

      <ConfirmDialog
        open={open}
        title="Reenviar invitación"
        message={`¿Reenviar invitación a ${userEmail}?`}
        confirmLabel="Reenviar"
        variant="primary"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
