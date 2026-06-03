"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MpCardForm } from "@/components/billing/MpCardForm";
import { subscribeGym } from "@/actions/billing";

interface Props {
  payerEmail: string;
}

export function GymCardFormSection({ payerEmail }: Props) {
  const router = useRouter();

  async function handleToken(cardTokenId: string, email: string) {
    const result = await subscribeGym({ cardTokenId, payerEmail: email || payerEmail });
    if (!result.success) {
      throw new Error(result.error);
    }
    toast.success("Suscripción configurada. El cobro se realizará al finalizar tu trial.");
    router.refresh();
  }

  return (
    <MpCardForm
      onToken={handleToken}
      payerEmail={payerEmail}
      monthlyAmountLabel="$40.000 ARS/mes"
      chargeHint="Podés configurar tu tarjeta en cualquier momento durante el trial. El cobro se realiza recién al finalizar el período de prueba."
    />
  );
}
