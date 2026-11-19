"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { RmMutationResult } from "@/components/RmFormView";

export interface DeleteRmButtonViewProps {
  rmId: string;
  onDeleteRm: (rmId: string) => Promise<RmMutationResult>;
}

/** Presentation-only deletion control; callers own the mutation implementation. */
export function DeleteRmButtonView({ rmId, onDeleteRm }: DeleteRmButtonViewProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await onDeleteRm(rmId);
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
