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
            ? "Es el único admin con acceso a recaudación y gastos en este gym."
            : next
            ? "Dar acceso a recaudación y gastos"
            : "Quitar acceso a recaudación y gastos"
        }
      >
        {user.canViewRevenue ? "Quitar recaud. y gastos" : "Dar recaud. y gastos"}
      </Button>
      <ConfirmDialog
        open={open}
        title={next ? "Habilitar recaudación y gastos" : "Deshabilitar recaudación y gastos"}
        message={
          error
            ? error
            : next
            ? `${user.name} va a poder ver la recaudación, gestionar productos y registrar gastos.`
            : `${user.name} ya no va a poder ver la recaudación, gestionar productos ni registrar gastos.`
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
