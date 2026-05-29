import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyMpWebhookSignature,
  preApproval,
  parseMpSubscriptionStatus,
} from "@/lib/mercadopago";
import { sendPaymentFailedEmail } from "@/lib/billing-emails";

export async function POST(req: NextRequest) {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  const dataId = req.nextUrl.searchParams.get("data.id");

  if (!xSignature) {
    return NextResponse.json({ error: "Missing x-signature" }, { status: 401 });
  }

  const isValid = verifyMpWebhookSignature(xSignature, xRequestId, dataId);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { type?: string; action?: string; data?: { id?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = body.type;
  const preapprovalId = body.data?.id;

  // Only handle subscription-related events
  if (
    eventType !== "subscription_preapproval" &&
    eventType !== "subscription_authorized_payment"
  ) {
    console.warn("[mp-webhook] Unknown event type — ignoring", { eventType });
    return NextResponse.json({ ok: true });
  }

  if (!preapprovalId) {
    console.warn("[mp-webhook] Missing preapproval id in event", { eventType });
    return NextResponse.json({ ok: true });
  }

  try {
    const sub = await preApproval.get({ id: preapprovalId });
    const gymId = sub.external_reference;
    const rawStatus = sub.status ?? "";

    if (!gymId) {
      console.warn("[mp-webhook] No external_reference on preapproval", { preapprovalId });
      return NextResponse.json({ ok: true });
    }

    const newStatus = parseMpSubscriptionStatus(rawStatus);

    console.log("[mp-webhook] Processing event", { gymId, preapprovalId, status: newStatus, eventType });

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { mpSubscriptionStatus: true, paymentExempt: true, name: true, slug: true },
    });

    if (!gym) {
      console.warn("[mp-webhook] Gym not found for external_reference", { gymId, preapprovalId });
      return NextResponse.json({ ok: true });
    }

    const previousStatus = gym.mpSubscriptionStatus;
    const statusChanged = newStatus !== previousStatus;

    await prisma.gym.update({
      where: { id: gymId },
      data: {
        mpPreapprovalId: preapprovalId,
        mpSubscriptionStatus: newStatus,
        ...(statusChanged ? { mpSubscriptionStatusChangedAt: new Date() } : {}),
      },
    });

    const isFailedStatus = newStatus === "paused" || newStatus === "cancelled";
    const wasPreviouslyFailed = previousStatus === "paused" || previousStatus === "cancelled";

    if (isFailedStatus && !wasPreviouslyFailed && !gym.paymentExempt) {
      try {
        await sendPaymentFailedEmail({ id: gymId, name: gym.name, slug: gym.slug });
      } catch (err) {
        console.warn("[mp-webhook] Failed to send payment-failed email", {
          gymId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mp-webhook] Internal error processing event", {
      eventType,
      preapprovalId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
