import React from "react";
import { sendEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import { PaymentFailedEmail } from "@/lib/email/templates/PaymentFailedEmail";

function getAppUrl() {
  return process.env.APP_URL ?? "https://www.wody.com.ar";
}

export async function sendPaymentFailedEmail(gym: { id: string; name: string; slug: string }) {
  const admins = await prisma.user.findMany({
    where: { gymId: gym.id, role: "ADMIN", deletedAt: null, email: { not: null } },
    select: { id: true, name: true, email: true },
  });

  if (admins.length === 0) {
    console.warn("[payment-failed-email] No admins found for gym", { gymId: gym.id });
    return;
  }

  const billingUrl = `${getAppUrl()}/${gym.slug}/admin/billing`;

  for (const admin of admins) {
    if (!admin.email) continue;
    await sendEmail({
      to: admin.email,
      gymId: gym.id,
      type: "PAYMENT_FAILED",
      subject: "No pudimos cobrar tu suscripción de Wody",
      react: React.createElement(PaymentFailedEmail, {
        contactName: admin.name ?? "Hola",
        gymName: gym.name,
        gymBillingUrl: billingUrl,
      }),
    });
  }
}
