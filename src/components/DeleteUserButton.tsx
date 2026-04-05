"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { deleteUser } from "@/actions/user";

interface DeleteUserButtonProps {
  userId: string;
  currentUserId: string;
}

export function DeleteUserButton({ userId, currentUserId }: DeleteUserButtonProps) {
  const [isPending, startTransition] = useTransition();
  const isSelf = userId === currentUserId;

  function handleDelete() {
    if (isSelf) return;
    if (!confirm("¿Seguro que querés eliminar este usuario? Esta acción no se puede deshacer.")) return;

    startTransition(async () => {
      await deleteUser(userId);
    });
  }

  return (
    <Button
      variant="danger"
      size="sm"
      onClick={handleDelete}
      disabled={isSelf || isPending}
      loading={isPending}
      title={isSelf ? "No podés eliminar tu propia cuenta" : "Eliminar usuario"}
    >
      Eliminar
    </Button>
  );
}
