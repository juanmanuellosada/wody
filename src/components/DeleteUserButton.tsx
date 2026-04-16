"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteUser } from "@/actions/user";

interface DeleteUserButtonProps {
  userId: string;
  currentUserId: string;
}

export function DeleteUserButton({ userId, currentUserId }: DeleteUserButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const isSelf = userId === currentUserId;

  function handleClick() {
    if (isSelf) return;
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      await deleteUser(userId);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={handleClick}
        disabled={isSelf || isPending}
        loading={isPending}
        title={isSelf ? "No podés eliminar tu propia cuenta" : "Eliminar usuario"}
      >
        Eliminar
      </Button>
      <ConfirmDialog
        open={open}
        title="Eliminar usuario"
        message="¿Seguro que querés eliminar este usuario? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
