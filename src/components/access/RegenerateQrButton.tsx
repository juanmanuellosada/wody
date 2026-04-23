"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { regenerateQrToken } from "@/actions/access";

interface RegenerateQrButtonProps {
  userId: string;
  // "self": el alumno desde su dashboard. "admin": admin sobre el alumno.
  scope?: "self" | "admin";
}

export function RegenerateQrButton({
  userId,
  scope = "self",
}: RegenerateQrButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const message =
    scope === "admin"
      ? "¿Regenerar el QR de este alumno? El QR anterior va a dejar de funcionar inmediatamente."
      : "¿Regenerar tu QR? El QR anterior va a dejar de funcionar inmediatamente.";

  function handleConfirm() {
    startTransition(async () => {
      await regenerateQrToken(userId);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        loading={isPending}
      >
        Regenerar QR
      </Button>
      <ConfirmDialog
        open={open}
        title="Regenerar QR"
        message={message}
        confirmLabel="Regenerar"
        variant="primary"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
