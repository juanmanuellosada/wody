import MercadoPagoConfig, { PreApproval } from "mercadopago";
import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from "mercadopago";
import { prisma } from "@/lib/prisma";

// Singleton MP config — reused across all calls in the same Node.js process.
const mpConfig = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export const preApproval = new PreApproval(mpConfig);

// ---------------------------------------------------------------------------
// Type: subscription status union
// ---------------------------------------------------------------------------

export type MpSubscriptionStatus =
  | "pending"
  | "authorized"
  | "paused"
  | "cancelled"
  | "unknown";

const KNOWN_STATUSES: MpSubscriptionStatus[] = [
  "pending",
  "authorized",
  "paused",
  "cancelled",
];

/** Maps any string from MP to a known MpSubscriptionStatus, logging unknown values. */
export function parseMpSubscriptionStatus(raw: string): MpSubscriptionStatus {
  const lower = raw.toLowerCase();
  if ((KNOWN_STATUSES as string[]).includes(lower)) {
    return lower as MpSubscriptionStatus;
  }
  console.warn(
    `[mercadopago] Unknown subscription status received: "${raw}" — treating as "unknown"`
  );
  return "unknown";
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Validates the HMAC-SHA256 signature on an incoming MP webhook.
 *
 * MP sends the signature in `x-signature` and a request ID in `x-request-id`.
 * The `dataId` comes from the `data.id` query param MP appends to the URL.
 *
 * Returns `true` if valid, `false` if invalid or secret is missing.
 */
export function verifyMpWebhookSignature(
  xSignature: string,
  xRequestId: string | null,
  dataId: string | null
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[mercadopago] MP_WEBHOOK_SECRET is not set — rejecting webhook");
    return false;
  }
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId,
      secret,
    });
    return true;
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError) {
      console.warn(
        `[mercadopago] Webhook signature invalid: ${err.reason}`
      );
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Subscription checkout URL
// ---------------------------------------------------------------------------

async function pickPlanIdForGym(gymId: string): Promise<string> {
  const gym = await prisma.gym.findUniqueOrThrow({
    where: { id: gymId },
    select: { mpPreapprovalId: true },
  });
  const newPlan = process.env.MP_PREAPPROVAL_PLAN_ID;
  if (!newPlan) throw new Error("MP_PREAPPROVAL_PLAN_ID env var is not set");
  if (gym.mpPreapprovalId == null) return newPlan;
  const returningPlan = process.env.MP_PREAPPROVAL_PLAN_ID_RETURNING;
  if (!returningPlan) {
    console.warn(
      "[mercadopago] MP_PREAPPROVAL_PLAN_ID_RETURNING not set — falling back to NEW plan; user will receive another free_trial",
      { gymId }
    );
    return newPlan;
  }
  return returningPlan;
}

/**
 * Builds the Mercado Pago checkout URL for the gym to subscribe to the plan.
 * Chooses the correct plan based on whether the gym has a previous subscription.
 * MP appends external_reference to identify which gym is subscribing.
 */
export async function getSubscriptionCheckoutUrl(gymId: string): Promise<string> {
  const planId = await pickPlanIdForGym(gymId);
  const url = new URL(
    "https://www.mercadopago.com.ar/subscriptions/checkout"
  );
  url.searchParams.set("preapproval_plan_id", planId);
  url.searchParams.set("external_reference", gymId);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Personal subscription checkout URL
// ---------------------------------------------------------------------------

async function pickPersonalPlanIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { mpPreapprovalId: true },
  });
  const newPlan = process.env.MP_PREAPPROVAL_PLAN_ID_PERSONAL;
  const returningPlan = process.env.MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING;
  if (!newPlan) throw new Error("MP_PREAPPROVAL_PLAN_ID_PERSONAL env var is not set");
  if (user.mpPreapprovalId == null) return newPlan;
  if (!returningPlan) {
    console.warn(
      "[mercadopago] MP_PREAPPROVAL_PLAN_ID_PERSONAL_RETURNING not set — falling back to NEW plan; user will receive another free_trial",
      { userId }
    );
    return newPlan;
  }
  return returningPlan;
}

/**
 * Builds the Mercado Pago checkout URL for a Personal user to subscribe.
 * Chooses the correct plan based on whether the user has a previous subscription.
 * Uses "user_" prefix on external_reference to discriminate from gym subscriptions in the webhook.
 */
export async function getPersonalSubscriptionCheckoutUrl(userId: string): Promise<string> {
  const planId = await pickPersonalPlanIdForUser(userId);
  const url = new URL(
    "https://www.mercadopago.com.ar/subscriptions/checkout"
  );
  url.searchParams.set("preapproval_plan_id", planId);
  url.searchParams.set("external_reference", `user_${userId}`);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Cancel a preapproval (subscription)
// ---------------------------------------------------------------------------

/** Cancels a gym's MP subscription via the preapproval update endpoint. */
export async function cancelMpPreapproval(preapprovalId: string): Promise<void> {
  await preApproval.update({
    id: preapprovalId,
    body: { status: "cancelled" },
  });
}
