"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setCanViewRevenue } from "@/actions/user";

interface ToggleCanViewRevenueButtonProps {
  user: {
    id: string;
    name: string;
    canViewRevenue: boolean;
  };
  /** true si el gym tiene un único admin designado (no se le puede quitar el permiso a nadie más). */
  isLastDesignated: boolean;
}

export function ToggleCanViewRevenueButton({
  user,
  isLastDesignated,
}: ToggleCanViewRevenueButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = !user.canViewRevenue;
  const blocked = user.canViewRevenue && isLastDesignated;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await setCanViewRevenue(user.id, next);
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
        onClick={() => !blocked && setOpen(true)}
        disabled={blocked || isPending}
        loading={isPending}
        title={
          blocked
            ? "Es el único admin que ve la recaudación en este gym."
            : next
            ? "Dar acceso a la recaudación"
            : "Quitar acceso a la recaudación"
        }
      >
        {user.canViewRevenue ? "Quitar recaudación" : "Dar recaudación"}
      </Button>
      <ConfirmDialog
        open={open}
        title={next ? "Habilitar recaudación" : "Deshabilitar recaudación"}
        message={
          error
            ? error
            : next
            ? `${user.name} va a poder ver la recaudación y el historial de pagos en Caja.`
            : `${user.name} ya no va a poder ver la recaudación ni el historial de pagos en Caja.`
        }
        confirmLabel={next ? "Habilitar" : "Deshabilitar"}
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
