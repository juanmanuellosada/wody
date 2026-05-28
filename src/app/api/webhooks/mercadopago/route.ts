import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyMpWebhookSignature,
  preApproval,
  parseMpSubscriptionStatus,
} from "@/lib/mercadopago";

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

    const status = parseMpSubscriptionStatus(rawStatus);

    console.log("[mp-webhook] Processing event", { gymId, preapprovalId, status, eventType });

    await prisma.gym.update({
      where: { id: gymId },
      data: {
        mpPreapprovalId: preapprovalId,
        mpSubscriptionStatus: status,
      },
    });

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
