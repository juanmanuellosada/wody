import React from "react";
import type { GymKind } from "@prisma/client";
import { sendEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import { PaymentFailedEmail } from "@/lib/email/templates/PaymentFailedEmail";
import { PersonalPaymentFailedEmail } from "@/lib/email/templates/PersonalPaymentFailedEmail";
import { PaymentDueStudentEmail, studentDueSubject } from "@/lib/email/templates/PaymentDueStudentEmail";
import { PaymentDueGymEmail, gymDueSubject } from "@/lib/email/templates/PaymentDueGymEmail";
import { PaymentDuePersonalEmail, personalDueSubject } from "@/lib/email/templates/PaymentDuePersonalEmail";

function getAppUrl() {
  return process.env.APP_URL ?? "https://www.wody.com.ar";
}

export async function sendPersonalPaymentFailedEmail(user: {
  id: string;
  name: string;
  email: string | null;
  gymId: string | null;
}) {
  if (!user.email) {
    console.warn("[personal-payment-failed-email] User has no email", { userId: user.id });
    return;
  }
  const billingUrl = `${getAppUrl()}/personal/perfil/suscripcion`;
  await sendEmail({
    to: user.email,
    gymId: user.gymId ?? null,
    type: "PERSONAL_PAYMENT_FAILED",
    subject: "No pudimos cobrar tu suscripción de Wody Personal",
    react: React.createElement(PersonalPaymentFailedEmail, {
      contactName: user.name,
      personalBillingUrl: billingUrl,
    }),
  });
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

export async function sendPaymentDueStudentEmail(
  user: { id: string; name: string; email: string | null },
  gym: { id: string; name: string; primaryColor: string | null; logo: string | null; kind: GymKind },
  dueDate: Date,
  daysRemaining: number
) {
  if (!user.email) {
    console.warn("[payment-due-student-email] User has no email", { userId: user.id });
    return { ok: false as const, error: "NO_EMAIL" };
  }
  return sendEmail({
    to: user.email,
    gymId: gym.id,
    type: "PAYMENT_DUE_STUDENT",
    subject: studentDueSubject(daysRemaining),
    react: React.createElement(PaymentDueStudentEmail, {
      gym,
      recipientName: user.name,
      dueDate,
      daysRemaining,
    }),
  });
}

export async function sendPaymentDueGymEmail(
  gym: { id: string; name: string; slug: string; subscriptionMonthlyAmount: number | null },
  dueDate: Date,
  daysRemaining: number
): Promise<{ sent: number; failed: number }> {
  const admins = await prisma.user.findMany({
    where: { gymId: gym.id, role: "ADMIN", deletedAt: null, email: { not: null } },
    select: { id: true, name: true, email: true },
  });

  const billingUrl = `${getAppUrl()}/${gym.slug}/admin/billing`;
  const subject = gymDueSubject(daysRemaining);

  let sent = 0;
  let failed = 0;

  for (const admin of admins) {
    if (!admin.email) continue;
    const result = await sendEmail({
      to: admin.email,
      gymId: gym.id,
      type: "PAYMENT_DUE_GYM",
      subject,
      react: React.createElement(PaymentDueGymEmail, {
        contactName: admin.name ?? "Hola",
        gymName: gym.name,
        dueDate,
        daysRemaining,
        monthlyAmount: gym.subscriptionMonthlyAmount ?? 0,
        gymBillingUrl: billingUrl,
      }),
    });
    if (result.ok) sent++;
    else failed++;
  }

  return { sent, failed };
}

export async function sendPaymentDuePersonalEmail(
  user: { id: string; name: string; email: string | null },
  dueDate: Date,
  daysRemaining: number
) {
  if (!user.email) {
    console.warn("[payment-due-personal-email] User has no email", { userId: user.id });
    return { ok: false as const, error: "NO_EMAIL" };
  }
  const billingUrl = `${getAppUrl()}/personal/perfil/suscripcion`;
  return sendEmail({
    to: user.email,
    gymId: null,
    type: "PAYMENT_DUE_PERSONAL",
    subject: personalDueSubject(daysRemaining),
    react: React.createElement(PaymentDuePersonalEmail, {
      contactName: user.name,
      dueDate,
      daysRemaining,
      personalBillingUrl: billingUrl,
    }),
  });
}
