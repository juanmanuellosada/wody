import { NextRequest, NextResponse } from "next/server";
import { verifyMpWebhookSignature } from "@/lib/mercadopago";
import {
  applyPreapprovalSnapshot,
  fetchPreapprovalSnapshot,
  notifyIfPaymentFailed,
  resolvePreapprovalId,
} from "@/lib/mp-sync";

export async function POST(req: NextRequest) {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature) {
    return NextResponse.json({ error: "Missing x-signature" }, { status: 401 });
  }

  let body: { type?: string; action?: string; data?: { id?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // MP sends `data.id` as a query param in some notification formats and only
  // in the body in others. The signature manifest needs whichever one arrived:
  // reading just the query param made valid notifications fail with a 401,
  // which MP retries a few times and then abandons silently.
  const dataId = req.nextUrl.searchParams.get("data.id") ?? body.data?.id ?? null;

  const isValid = verifyMpWebhookSignature(xSignature, xRequestId, dataId);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventType = body.type;

  // Only handle subscription-related events
  if (
    eventType !== "subscription_preapproval" &&
    eventType !== "subscription_authorized_payment"
  ) {
    console.warn("[mp-webhook] Unknown event type — ignoring", { eventType });
    return NextResponse.json({ ok: true });
  }

  if (!dataId) {
    console.warn("[mp-webhook] Missing data id in event", { eventType });
    return NextResponse.json({ ok: true });
  }

  try {
    const preapprovalId = await resolvePreapprovalId(eventType, dataId);

    if (!preapprovalId) {
      console.warn("[mp-webhook] Could not resolve a preapproval for event", { eventType, dataId });
      return NextResponse.json({ ok: true });
    }

    const snapshot = await fetchPreapprovalSnapshot(preapprovalId);

    if (!snapshot) {
      console.warn("[mp-webhook] No external_reference on preapproval", { preapprovalId });
      return NextResponse.json({ ok: true });
    }

    console.log("[mp-webhook] Processing event", {
      eventType,
      preapprovalId,
      externalReference: snapshot.externalReference,
      status: snapshot.status,
      nextPaymentDate: snapshot.nextPaymentDate,
    });

    const outcome = await applyPreapprovalSnapshot(snapshot);

    if (!outcome.ok) {
      console.warn("[mp-webhook] No record found for external_reference", {
        externalReference: snapshot.externalReference,
        preapprovalId,
      });
      return NextResponse.json({ ok: true });
    }

    await notifyIfPaymentFailed(outcome);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mp-webhook] Internal error processing event", {
      eventType,
      dataId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
