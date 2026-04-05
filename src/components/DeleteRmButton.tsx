"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { deleteRm } from "@/actions/rm";

interface DeleteRmButtonProps {
  rmId: string;
}

export function DeleteRmButton({ rmId }: DeleteRmButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteRm(rmId);
    });
  }

  return (
    <Button
      variant="danger"
      size="sm"
      loading={isPending}
      onClick={handleDelete}
    >
      Eliminar
    </Button>
  );
}
