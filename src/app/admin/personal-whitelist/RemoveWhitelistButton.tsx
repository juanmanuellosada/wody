"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFromWhitelist } from "@/actions/personal-whitelist";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Props {
  email: string;
}

export function RemoveWhitelistButton({ email }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleConfirm() {
    startTransition(async () => {
      const result = await removeFromWhitelist({ email });
      setOpen(false);
      if (result.ok) {
        router.refresh();
      } else {
        setFeedback("No se encontró el email en la whitelist.");
        setTimeout(() => setFeedback(null), 5000);
      }
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} loading={isPending}>
        Quitar
      </Button>

      {feedback && (
        <span className="text-xs font-heading font-bold uppercase tracking-wide text-brand-red" role="alert">
          {feedback}
        </span>
      )}

      <ConfirmDialog
        open={open}
        title="Quitar de la whitelist"
        message={`Vas a quitar "${email}" de la whitelist. El usuario personal asociado (si existe) no se verá afectado.`}
        confirmLabel="Quitar"
        variant="danger"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
