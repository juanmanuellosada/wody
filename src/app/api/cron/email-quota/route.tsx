import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import { QuotaAlertEmail } from "@/lib/email/templates/QuotaAlertEmail";

// Vercel Cron: 12:00 ART (15:00 UTC) daily — see vercel.json.
// Cuenta los envíos exitosos del mes en curso y envía alertas al 80% y 95%
// del límite mensual configurado en EMAIL_QUOTA_MONTHLY_LIMIT.

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const isAuthorized =
    (expected && auth === `Bearer ${expected}`) || vercelCron === "1";
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alertTo = process.env.EMAIL_QUOTA_ALERT_TO;
  if (!alertTo) {
    console.error("[email-quota-cron] EMAIL_QUOTA_ALERT_TO no configurada");
    return NextResponse.json(
      { ok: false, error: "EMAIL_QUOTA_ALERT_TO no configurada" },
      { status: 500 }
    );
  }

  const now = new Date();
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );

  // Solo contar tipos que consumen cuota (excluir QUOTA_ALERT_* para evitar falsos positivos)
  const sentThisMonth = await prisma.emailLog.count({
    where: {
      status: "SENT",
      sentAt: { gte: startOfMonth },
      type: { in: ["INVITE", "RESET"] },
    },
  });

  const limit = parseInt(process.env.EMAIL_QUOTA_MONTHLY_LIMIT ?? "3000", 10);
  const ratio = sentThisMonth / limit;

  const monthLabel = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(now);

  let alertSent: "80" | "95" | null = null;

  if (ratio >= 0.95) {
    // dedupea por SENT, no por cualquier row, para permitir reintento si Resend falló
    const already = await prisma.emailLog.count({
      where: {
        type: "QUOTA_ALERT_95",
        status: "SENT",
        sentAt: { gte: startOfMonth },
      },
    });
    if (already === 0) {
      await sendEmail({
        to: alertTo,
        gymId: null,
        type: "QUOTA_ALERT_95",
        subject: "Wody · Cuota mensual al 95%",
        react: React.createElement(QuotaAlertEmail, {
          threshold: 95,
          currentCount: sentThisMonth,
          monthlyLimit: limit,
          monthLabel,
        }),
      });
      alertSent = "95";
    }
  } else if (ratio >= 0.80) {
    // dedupea por SENT, no por cualquier row, para permitir reintento si Resend falló
    const already = await prisma.emailLog.count({
      where: {
        type: "QUOTA_ALERT_80",
        status: "SENT",
        sentAt: { gte: startOfMonth },
      },
    });
    if (already === 0) {
      await sendEmail({
        to: alertTo,
        gymId: null,
        type: "QUOTA_ALERT_80",
        subject: "Wody · Cuota mensual al 80%",
        react: React.createElement(QuotaAlertEmail, {
          threshold: 80,
          currentCount: sentThisMonth,
          monthlyLimit: limit,
          monthLabel,
        }),
      });
      alertSent = "80";
    }
  }

  return NextResponse.json({
    ok: true,
    sentThisMonth,
    limit,
    ratio: Math.round(ratio * 100) / 100,
    alertSent,
  });
}
