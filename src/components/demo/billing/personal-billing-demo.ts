// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { getPersonalTrainingActorToken } from "../training/personal-training-demo-state.ts";
import type { PersonalBillingViewData } from "../../personal/personal-billing-view-contracts";

const DAY_MS = 24 * 60 * 60 * 1000;
const FICTIONAL_AUTHORIZED_NEXT_PAYMENT_AT = "2030-06-15T12:00:00.000Z";
const PERSONAL_STUDENT_CAPABILITY = getPersonalTrainingActorToken();

/**
 * These are display-only scenarios. A future mount must label this surface
 * "Demo — sin cobros ni redirecciones" and must not connect these projections
 * to billing actions, storage, or a payment provider.
 */
export const PERSONAL_BILLING_DEMO_SCENARIOS = Object.freeze([
  "trial",
  "trial-tomorrow",
  "trial-today",
  "trial-expired",
  "exempt",
  "authorized",
  "paused",
  "cancelled",
  "no-subscription",
] as const);

export type PersonalBillingDemoScenario = (typeof PERSONAL_BILLING_DEMO_SCENARIOS)[number];

/** Serializable projection: no account identity, credentials, provider identifiers, or URLs. */
export type PersonalBillingDemoProjection = {
  trialEndsAt: string | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  currentStatus: "authorized" | "paused" | "cancelled" | null;
  nextPaymentDate: string | null;
  hasSubscription: boolean;
  daysRemaining: number | null;
};

function isScenario(value: unknown): value is PersonalBillingDemoScenario {
  switch (value) {
    case "trial":
    case "trial-tomorrow":
    case "trial-today":
    case "trial-expired":
    case "exempt":
    case "authorized":
    case "paused":
    case "cancelled":
    case "no-subscription":
      return true;
    default:
      return false;
  }
}

function readTrustedClock(clock: unknown): number | null {
  if (typeof clock !== "function") return null;
  const value = clock();
  try {
    if (Object.getPrototypeOf(value) !== Date.prototype) return null;
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  } catch {
    return null;
  }
}

function isoAt(time: number): string | null {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** This deliberately retains Math.ceil's negative-zero result for just-expired trials. */
export function calculatePersonalBillingDaysRemaining(trialEndsAt: Date, now: Date): number | null {
  try {
    if (Object.getPrototypeOf(trialEndsAt) !== Date.prototype || Object.getPrototypeOf(now) !== Date.prototype) return null;
    const end = trialEndsAt.getTime();
    const current = now.getTime();
    if (!Number.isFinite(end) || !Number.isFinite(current)) return null;
    return Math.ceil((end - current) / DAY_MS);
  } catch {
    return null;
  }
}

function trialProjection(now: number, offsetDays: number): PersonalBillingDemoProjection | null {
  const end = now + offsetDays * DAY_MS;
  const trialEndsAt = isoAt(end);
  if (trialEndsAt === null) return null;
  return {
    trialEndsAt,
    paymentExempt: false,
    paymentExemptReason: null,
    currentStatus: null,
    nextPaymentDate: null,
    hasSubscription: false,
    daysRemaining: Math.ceil((end - now) / DAY_MS),
  };
}

/**
 * Selects a detached fictional projection after identity-based capability
 * validation. Unknown, copied, foreign, and hostile actor values are denied
 * before the scenario, clock, or fixture data is read.
 */
export function projectPersonalBillingDemoScenario(
  actor: unknown,
  scenario: unknown,
  clock: unknown,
): PersonalBillingDemoProjection | null {
  if (actor !== PERSONAL_STUDENT_CAPABILITY) return null;
  if (!isScenario(scenario)) return null;
  const now = readTrustedClock(clock);
  if (now === null) return null;

  switch (scenario) {
    case "trial":
      return trialProjection(now, 7);
    case "trial-tomorrow":
      return trialProjection(now, 1);
    case "trial-today":
      return trialProjection(now, 0);
    case "trial-expired":
      return trialProjection(now, -1);
    case "exempt":
      return {
        trialEndsAt: null,
        paymentExempt: true,
        paymentExemptReason: "Cuenta de demostración exenta.",
        currentStatus: null,
        nextPaymentDate: null,
        hasSubscription: false,
        daysRemaining: null,
      };
    case "authorized":
      return {
        trialEndsAt: null,
        paymentExempt: false,
        paymentExemptReason: null,
        currentStatus: "authorized",
        nextPaymentDate: FICTIONAL_AUTHORIZED_NEXT_PAYMENT_AT,
        hasSubscription: true,
        daysRemaining: null,
      };
    case "paused":
      return {
        trialEndsAt: null,
        paymentExempt: false,
        paymentExemptReason: null,
        currentStatus: "paused",
        nextPaymentDate: null,
        hasSubscription: true,
        daysRemaining: null,
      };
    case "cancelled":
      return {
        trialEndsAt: null,
        paymentExempt: false,
        paymentExemptReason: null,
        currentStatus: "cancelled",
        nextPaymentDate: null,
        hasSubscription: true,
        daysRemaining: null,
      };
    case "no-subscription":
      return {
        trialEndsAt: null,
        paymentExempt: false,
        paymentExemptReason: null,
        currentStatus: null,
        nextPaymentDate: null,
        hasSubscription: false,
        daysRemaining: null,
      };
  }
}

/** Converts the serializable demo projection to fresh Date values at the view boundary. */
export function toPersonalBillingViewData(
  projection: PersonalBillingDemoProjection,
): PersonalBillingViewData {
  return {
    trialEndsAt: projection.trialEndsAt === null ? null : new Date(projection.trialEndsAt),
    paymentExempt: projection.paymentExempt,
    paymentExemptReason: projection.paymentExemptReason,
    mpSubscriptionStatus: projection.currentStatus,
    subscriptionNextPaymentDate: projection.nextPaymentDate === null ? null : new Date(projection.nextPaymentDate),
    hasSubscription: projection.hasSubscription,
    daysLeftInTrial: projection.daysRemaining,
    userEmail: "",
  };
}

/** Exposes the existing opaque PERSONAL capability to a future local-only mount. */
export function getPersonalBillingDemoActorToken() {
  return PERSONAL_STUDENT_CAPABILITY;
}
