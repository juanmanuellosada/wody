"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { promoteTeacherToAdmin } from "@/actions/user";

interface PromoteTeacherButtonProps {
  user: {
    id: string;
    name: string;
    blockedAt: Date | null;
  };
}

export function PromoteTeacherButton({ user }: PromoteTeacherButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBlocked = user.blockedAt !== null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("userId", user.id);
      const result = await promoteTeacherToAdmin(formData);
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => !isBlocked && setOpen(true)}
        disabled={isBlocked || isPending}
        loading={isPending}
        title={isBlocked ? "El usuario está bloqueado" : "Promover a admin"}
      >
        Promover a admin
      </Button>
      <ConfirmDialog
        open={open}
        title="Promover a admin"
        message={
          error
            ? error
            : `Vas a promover a ${user.name} a ADMIN. El cambio se reflejará en su sesión cuando vuelva a iniciar sesión.`
        }
        confirmLabel="Promover"
        variant="primary"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
