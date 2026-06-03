import MercadoPagoConfig, { PreApproval } from "mercadopago";
import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from "mercadopago";
import type { AutoRecurringWithFreeTrial } from "mercadopago/dist/clients/preApproval/commonTypes";

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
// Trial days helper
// ---------------------------------------------------------------------------

/**
 * Calculates the number of days remaining in the trial period (in UTC).
 * Returns ceil((trialEndsAt - now) / 1 day). May be negative if trial has passed.
 * Returns null if trialEndsAt is null.
 */
export function calcDaysRemaining(trialEndsAt: Date | null): number | null {
  if (trialEndsAt == null) return null;
  const diffMs = trialEndsAt.getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type CreateSubscriptionResult =
  | { ok: true; mpPreapprovalId: string; mpSubscriptionStatus: MpSubscriptionStatus; initPoint: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Gym subscription (no plan, free_trial dynamic)
// ---------------------------------------------------------------------------

/**
 * Creates a MercadoPago preapproval for a gym subscription via API (no plan).
 * Returns a pending preapproval with an init_point URL for the user to authorize
 * the subscription via redirect (no card capture in-app).
 *
 * Monto: $40.000 ARS/mes (constante per spec; subscriptionMonthlyAmount en DB
 * es referencia interna del super-admin y no afecta el cobro real en MP).
 *
 * El free_trial se calcula dinámicamente: si díasRestantes >= 1, se incluye
 * free_trial con esa cantidad de días; si <= 0, se omite (cobro inmediato).
 */
export async function createGymSubscription(params: {
  gymId: string;
  trialEndsAt: Date | null;
}): Promise<CreateSubscriptionResult> {
  const { gymId, trialEndsAt } = params;

  const diasRestantes = calcDaysRemaining(trialEndsAt);

  const autoRecurring: AutoRecurringWithFreeTrial = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: 40000,
    currency_id: "ARS",
    ...(diasRestantes !== null && diasRestantes >= 1
      ? { free_trial: { frequency: diasRestantes, frequency_type: "days" } }
      : {}),
  };

  try {
    const response = await preApproval.create({
      body: {
        status: "pending",
        external_reference: gymId,
        reason: "Suscripción mensual Wody",
        back_url: `${process.env.APP_URL ?? "https://wody.com.ar"}`,
        // Cast needed: SDK types PreApprovalRequest.auto_recurring as
        // AutoRecurringRequest (no free_trial), but the API accepts
        // AutoRecurringWithFreeTrial at runtime.
        auto_recurring: autoRecurring as never,
      },
    });

    const id = response.id;
    const initPoint = response.init_point;
    const rawStatus = response.status ?? "";

    if (!id) {
      console.error("[mercadopago] createGymSubscription: no id in response", response);
      return { ok: false, error: "Mercado Pago no devolvió un ID de suscripción" };
    }

    if (!initPoint) {
      console.error("[mercadopago] createGymSubscription: no init_point in response", response);
      return { ok: false, error: "Mercado Pago no devolvió la URL de autorización" };
    }

    return {
      ok: true,
      mpPreapprovalId: id,
      mpSubscriptionStatus: parseMpSubscriptionStatus(rawStatus),
      initPoint,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mercadopago] createGymSubscription error", { gymId, error: msg });
    return { ok: false, error: "Error al crear la suscripción. Intentá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Personal subscription (no plan, free_trial dynamic) — mirror function
// ---------------------------------------------------------------------------

/**
 * Creates a MercadoPago preapproval for a Wody Personal user subscription via API (no plan).
 * Returns a pending preapproval with an init_point URL for the user to authorize
 * the subscription via redirect (no card capture in-app).
 *
 * Monto: $7.000 ARS/mes (constante per spec).
 * external_reference: "user_<userId>" (distingue de suscripciones de gym en el webhook).
 *
 * El free_trial se calcula dinámicamente: si díasRestantes >= 1, se incluye
 * free_trial con esa cantidad de días; si <= 0, se omite (cobro inmediato).
 */
export async function createPersonalSubscription(params: {
  userId: string;
  trialEndsAt: Date | null;
}): Promise<CreateSubscriptionResult> {
  const { userId, trialEndsAt } = params;

  const diasRestantes = calcDaysRemaining(trialEndsAt);

  const autoRecurring: AutoRecurringWithFreeTrial = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: 7000,
    currency_id: "ARS",
    ...(diasRestantes !== null && diasRestantes >= 1
      ? { free_trial: { frequency: diasRestantes, frequency_type: "days" } }
      : {}),
  };

  try {
    const response = await preApproval.create({
      body: {
        status: "pending",
        external_reference: `user_${userId}`,
        reason: "Suscripción mensual Wody Personal",
        back_url: `${process.env.APP_URL ?? "https://wody.com.ar"}`,
        // Cast needed: same as createGymSubscription.
        auto_recurring: autoRecurring as never,
      },
    });

    const id = response.id;
    const initPoint = response.init_point;
    const rawStatus = response.status ?? "";

    if (!id) {
      console.error("[mercadopago] createPersonalSubscription: no id in response", response);
      return { ok: false, error: "Mercado Pago no devolvió un ID de suscripción" };
    }

    if (!initPoint) {
      console.error("[mercadopago] createPersonalSubscription: no init_point in response", response);
      return { ok: false, error: "Mercado Pago no devolvió la URL de autorización" };
    }

    return {
      ok: true,
      mpPreapprovalId: id,
      mpSubscriptionStatus: parseMpSubscriptionStatus(rawStatus),
      initPoint,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mercadopago] createPersonalSubscription error", { userId, error: msg });
    return { ok: false, error: "Error al crear la suscripción. Intentá de nuevo." };
  }
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
