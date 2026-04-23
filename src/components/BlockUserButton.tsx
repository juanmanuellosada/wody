"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setUserBlocked } from "@/actions/user";

interface BlockUserButtonProps {
  userId: string;
  currentUserId: string;
  userRole: "ADMIN" | "TEACHER" | "STUDENT" | "ACCESS";
  blocked: boolean;
}

export function BlockUserButton({
  userId,
  currentUserId,
  userRole,
  blocked,
}: BlockUserButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const isSelf = userId === currentUserId;
  const isAdminTarget = userRole === "ADMIN";
  if (isSelf || isAdminTarget) return null;

  function handleConfirm() {
    startTransition(async () => {
      await setUserBlocked(userId, !blocked);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant={blocked ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
        loading={isPending}
        title={blocked ? "Desbloquear usuario" : "Bloquear usuario"}
      >
        {blocked ? "Desbloquear" : "Bloquear"}
      </Button>
      <ConfirmDialog
        open={open}
        title={blocked ? "Desbloquear usuario" : "Bloquear usuario"}
        message={
          blocked
            ? "¿Desbloquear a este usuario? Va a poder ingresar de nuevo."
            : "¿Bloquear a este usuario? No va a poder ingresar hasta que lo desbloquees."
        }
        confirmLabel={blocked ? "Desbloquear" : "Bloquear"}
        variant={blocked ? "primary" : "danger"}
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
