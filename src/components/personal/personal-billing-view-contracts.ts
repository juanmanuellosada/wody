export type PersonalBillingActionResult =
  | { success: true }
  | { success: false; error: string };

export type PersonalBillingSubscribeResult =
  | { success: true; initPoint: string }
  | { success: false; error: string };

export type PersonalBillingViewData = {
  trialEndsAt: Date | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  mpSubscriptionStatus: string | null;
  subscriptionNextPaymentDate: Date | null;
  /** This is only the presence of a subscription record, never its identifier. */
  hasSubscription: boolean;
  daysLeftInTrial: number | null;
  userEmail: string;
};

export type PersonalBillingViewCallbacks = {
  onCancelSubscription: () => Promise<PersonalBillingActionResult>;
  onCancelSuccess: () => void;
  onCancelFailure: (error: string) => void;
  onSubscribe: (payerEmail: string) => Promise<PersonalBillingSubscribeResult>;
  onSubscribeSuccess: (initPoint: string) => void;
};

export type PersonalBillingPageViewProps = PersonalBillingViewData & PersonalBillingViewCallbacks;

export const PERSONAL_BILLING_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function trialHeadline(daysLeft: number | null): string {
  if (daysLeft === null) return "Tu suscripción";
  if (daysLeft > 1) return `Tu trial termina en ${daysLeft} días`;
  if (daysLeft === 1) return "Tu trial termina mañana";
  if (daysLeft === 0) return "Tu trial termina hoy";
  return `Tu trial venció hace ${-daysLeft} días`;
}

export type PersonalBillingDisplayBranch = "exempt" | "authorized" | "subscribe";

/** The exempt branch intentionally wins over every provider-status branch. */
export function getPersonalBillingDisplayBranch(
  paymentExempt: boolean,
  mpSubscriptionStatus: string | null,
): PersonalBillingDisplayBranch {
  if (paymentExempt) return "exempt";
  return mpSubscriptionStatus === "authorized" ? "authorized" : "subscribe";
}

export function isPausedOrCancelledSubscription(
  hasSubscription: boolean,
  mpSubscriptionStatus: string | null,
): boolean {
  return hasSubscription && (mpSubscriptionStatus === "paused" || mpSubscriptionStatus === "cancelled");
}
