"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelMySubscription, subscribePersonal } from "@/actions/personal-billing";
import { PersonalBillingPageView } from "./PersonalBillingPageView";

export interface PersonalBillingPageProps {
  trialEndsAt: Date | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  mpSubscriptionStatus: string | null;
  subscriptionNextPaymentDate: Date | null;
  mpPreapprovalId: string | null;
  daysLeftInTrial: number | null;
  userEmail: string;
}

export function PersonalBillingPage({
  trialEndsAt,
  paymentExempt,
  paymentExemptReason,
  mpSubscriptionStatus,
  subscriptionNextPaymentDate,
  mpPreapprovalId,
  daysLeftInTrial,
  userEmail,
}: PersonalBillingPageProps) {
  const router = useRouter();

  return (
    <PersonalBillingPageView
      trialEndsAt={trialEndsAt}
      paymentExempt={paymentExempt}
      paymentExemptReason={paymentExemptReason}
      mpSubscriptionStatus={mpSubscriptionStatus}
      subscriptionNextPaymentDate={subscriptionNextPaymentDate}
      hasSubscription={mpPreapprovalId !== null}
      daysLeftInTrial={daysLeftInTrial}
      userEmail={userEmail}
      onCancelSubscription={cancelMySubscription}
      onCancelSuccess={() => {
        toast.success("Suscripción cancelada.");
        router.refresh();
      }}
      onCancelFailure={(error) => toast.error(error)}
      onSubscribe={subscribePersonal}
      onSubscribeSuccess={(initPoint) => {
        window.location.href = initPoint;
      }}
    />
  );
}
