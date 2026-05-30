import React from "react";
import type { GymSignupRequest } from "@prisma/client";
import { sendEmail } from "@/lib/email/send";
import { LeadReceivedEmail } from "@/lib/email/templates/LeadReceivedEmail";
import { LeadApprovedEmail } from "@/lib/email/templates/LeadApprovedEmail";
import { LeadRejectedEmail } from "@/lib/email/templates/LeadRejectedEmail";
import { PersonalLeadReceivedEmail } from "@/lib/email/templates/PersonalLeadReceivedEmail";
import { PersonalLeadApprovedEmail } from "@/lib/email/templates/PersonalLeadApprovedEmail";
import { PersonalLeadRejectedEmail } from "@/lib/email/templates/PersonalLeadRejectedEmail";

const APP_URL = process.env.APP_URL ?? "https://www.wody.com.ar";

export async function sendLeadReceivedEmail(req: GymSignupRequest) {
  return sendEmail({
    to: req.email,
    gymId: null,
    type: "LEAD_RECEIVED",
    subject: "Recibimos tu consulta",
    react: React.createElement(LeadReceivedEmail, {
      contactName: req.contactName,
      gymName: req.gymName ?? "",
    }),
  });
}

export async function sendLeadApprovedEmail(req: GymSignupRequest) {
  if (!req.onboardingToken || !req.tokenExpiresAt) {
    console.warn("[signup-emails] sendLeadApprovedEmail called without token or expiry — skipping");
    return { ok: false as const, error: "MISSING_TOKEN" };
  }

  const onboardingUrl = `${APP_URL}/onboarding/${req.onboardingToken}`;

  return sendEmail({
    to: req.email,
    gymId: null,
    type: "LEAD_APPROVED",
    subject: "Tu gym está aprobado en Wody",
    react: React.createElement(LeadApprovedEmail, {
      contactName: req.contactName,
      gymName: req.gymName ?? "",
      onboardingUrl,
      tokenExpiresAt: req.tokenExpiresAt,
    }),
  });
}

export async function sendLeadRejectedEmail(req: GymSignupRequest) {
  return sendEmail({
    to: req.email,
    gymId: null,
    type: "LEAD_REJECTED",
    subject: "Respuesta sobre tu solicitud en Wody",
    react: React.createElement(LeadRejectedEmail, {
      contactName: req.contactName,
      gymName: req.gymName ?? "",
      rejectionReason: req.rejectionReason,
    }),
  });
}

export async function sendPersonalLeadReceivedEmail(req: GymSignupRequest) {
  return sendEmail({
    to: req.email,
    gymId: null,
    type: "PERSONAL_LEAD_RECEIVED",
    subject: "Recibimos tu consulta para Wody Personal",
    react: React.createElement(PersonalLeadReceivedEmail, {
      contactName: req.contactName,
    }),
  });
}

export async function sendPersonalLeadApprovedEmail(req: GymSignupRequest) {
  return sendEmail({
    to: req.email,
    gymId: null,
    type: "PERSONAL_LEAD_APPROVED",
    subject: "Estás dentro de Wody Personal",
    react: React.createElement(PersonalLeadApprovedEmail, {
      contactName: req.contactName,
      registroUrl: `${APP_URL}/registro-personal`,
    }),
  });
}

export async function sendPersonalLeadRejectedEmail(req: GymSignupRequest) {
  return sendEmail({
    to: req.email,
    gymId: null,
    type: "PERSONAL_LEAD_REJECTED",
    subject: "Respuesta sobre tu solicitud de Wody Personal",
    react: React.createElement(PersonalLeadRejectedEmail, {
      contactName: req.contactName,
      rejectionReason: req.rejectionReason ?? undefined,
    }),
  });
}
