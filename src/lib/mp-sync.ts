import { prisma } from "@/lib/prisma";
import {
  invoice,
  parseMpSubscriptionStatus,
  preApproval,
  type MpSubscriptionStatus,
} from "@/lib/mercadopago";
import { sendPaymentFailedEmail, sendPersonalPaymentFailedEmail } from "@/lib/billing-emails";

/**
 * Persistence of a Mercado Pago preapproval into our own records.
 *
 * Both the webhook and the super-admin "Sincronizar con MP" action go through
 * here, so the two paths cannot drift apart. Mercado Pago is the source of
 * truth: whatever it reports about a subscription overwrites what we hold.
 */

type PreapprovalSnapshot = {
  id: string;
  externalReference: string;
  status: MpSubscriptionStatus;
  nextPaymentDate: Date | null;
};

export type SyncOutcome =
  | { ok: false; reason: "not-found" }
  | {
      ok: true;
      kind: "gym" | "personal";
      id: string;
      previousStatus: string | null;
      newStatus: MpSubscriptionStatus;
      statusChanged: boolean;
    };

/** MP returns ISO-8601 strings; anything unparseable is treated as absent. */
function parseNextPaymentDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Fetches a preapproval from MP and normalizes the fields we persist.
 * Returns `null` when MP does not report an `external_reference`, since
 * without it there is no way to tell which record the event belongs to.
 */
export async function fetchPreapprovalSnapshot(
  preapprovalId: string
): Promise<PreapprovalSnapshot | null> {
  const sub = await preApproval.get({ id: preapprovalId });
  const externalReference = sub.external_reference;

  if (!externalReference) return null;

  return {
    id: preapprovalId,
    externalReference,
    status: parseMpSubscriptionStatus(sub.status ?? ""),
    nextPaymentDate: parseNextPaymentDate(sub.next_payment_date),
  };
}

/**
 * Resolves a webhook event to the preapproval it concerns.
 *
 * `subscription_preapproval` carries the preapproval id directly.
 * `subscription_authorized_payment` carries an *invoice* id instead — the one
 * event that reports monthly charges and retries — so the invoice has to be
 * fetched first to learn which subscription it belongs to.
 */
export async function resolvePreapprovalId(
  eventType: string,
  dataId: string
): Promise<string | null> {
  if (eventType === "subscription_preapproval") return dataId;

  if (eventType === "subscription_authorized_payment") {
    const found = await invoice.get({ id: dataId });
    const preapprovalId = found.preapproval_id;
    if (!preapprovalId) {
      console.warn("[mp-sync] Invoice has no preapproval_id", { invoiceId: dataId });
      return null;
    }
    return preapprovalId;
  }

  return null;
}

/**
 * Writes a preapproval snapshot onto the gym or Personal user it belongs to.
 *
 * `mpSubscriptionStatusChangedAt` only moves on a real state transition, so a
 * repeated webhook stays idempotent. A missing `next_payment_date` leaves the
 * stored date untouched rather than clearing it — a partial response from MP
 * must never degrade data we already hold.
 */
export async function applyPreapprovalSnapshot(
  snapshot: PreapprovalSnapshot
): Promise<SyncOutcome> {
  const { id: preapprovalId, externalReference, status, nextPaymentDate } = snapshot;

  if (externalReference.startsWith("user_")) {
    const userId = externalReference.slice("user_".length);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mpSubscriptionStatus: true },
    });

    if (!user) return { ok: false, reason: "not-found" };

    const previousStatus = user.mpSubscriptionStatus;
    const statusChanged = status !== previousStatus;

    await prisma.user.update({
      where: { id: userId },
      data: {
        mpPreapprovalId: preapprovalId,
        mpSubscriptionStatus: status,
        ...(statusChanged ? { mpSubscriptionStatusChangedAt: new Date() } : {}),
        // Distinct from `nextPaymentDate`, which is the student's fee to their
        // gym and governs auto-blocking. This one is their Wody subscription.
        ...(nextPaymentDate !== null ? { subscriptionNextPaymentDate: nextPaymentDate } : {}),
      },
    });

    return { ok: true, kind: "personal", id: userId, previousStatus, newStatus: status, statusChanged };
  }

  const gymId = externalReference;
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { mpSubscriptionStatus: true },
  });

  if (!gym) return { ok: false, reason: "not-found" };

  const previousStatus = gym.mpSubscriptionStatus;
  const statusChanged = status !== previousStatus;

  await prisma.gym.update({
    where: { id: gymId },
    data: {
      mpPreapprovalId: preapprovalId,
      mpSubscriptionStatus: status,
      ...(statusChanged ? { mpSubscriptionStatusChangedAt: new Date() } : {}),
      ...(nextPaymentDate !== null ? { subscriptionNextPaymentDate: nextPaymentDate } : {}),
    },
  });

  return { ok: true, kind: "gym", id: gymId, previousStatus, newStatus: status, statusChanged };
}

/**
 * Sends the payment-failed notification when a subscription enters a failed
 * state it was not already in.
 *
 * Only a preapproval turning `paused`/`cancelled` counts as a failure. A single
 * rejected charge does not: MP keeps retrying while the subscription stays
 * authorized, and warning the owner mid-retry would flag as delinquent someone
 * who ends up paying two days later.
 */
export async function notifyIfPaymentFailed(outcome: SyncOutcome): Promise<void> {
  if (!outcome.ok) return;

  const isFailedStatus = outcome.newStatus === "paused" || outcome.newStatus === "cancelled";
  const wasPreviouslyFailed =
    outcome.previousStatus === "paused" || outcome.previousStatus === "cancelled";

  if (!isFailedStatus || wasPreviouslyFailed) return;

  try {
    if (outcome.kind === "personal") {
      const user = await prisma.user.findUnique({
        where: { id: outcome.id },
        select: { name: true, email: true, gymId: true, paymentExempt: true },
      });
      if (!user || user.paymentExempt) return;
      await sendPersonalPaymentFailedEmail({
        id: outcome.id,
        name: user.name,
        email: user.email,
        gymId: user.gymId,
      });
      return;
    }

    const gym = await prisma.gym.findUnique({
      where: { id: outcome.id },
      select: { name: true, slug: true, paymentExempt: true },
    });
    if (!gym || gym.paymentExempt) return;
    await sendPaymentFailedEmail({ id: outcome.id, name: gym.name, slug: gym.slug });
  } catch (err) {
    console.warn("[mp-sync] Failed to send payment-failed email", {
      kind: outcome.kind,
      id: outcome.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
