"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/actions/super-admin/gym";
import type { ActionResult } from "@/actions/super-admin/gym";
import {
  generateOnboardingToken,
  computeTokenExpiresAt,
  isTokenExpired,
  canTransition,
} from "@/lib/signup-request";
import {
  sendLeadApprovedEmail,
  sendLeadRejectedEmail,
} from "@/lib/signup-emails";
import type { SignupRequestStatus, SignupRequestType } from "@prisma/client";

export type SignupRequestRow = {
  id: string;
  type: SignupRequestType;
  email: string;
  contactName: string;
  gymName: string | null;
  gymKindSuggested: string | null;
  phone: string | null;
  expectedStudents: number | null;
  status: SignupRequestStatus;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  completedAt: Date | null;
  tokenExpiresAt: Date | null;
  createdByAdminId: string | null;
};

export type SignupRequestDetail = SignupRequestRow & {
  message: string | null;
  onboardingToken: string | null;
  rejectionReason: string | null;
  gymId: string | null;
  type: SignupRequestType;
};

export async function listSignupRequests(filter?: {
  status?: SignupRequestStatus;
}): Promise<SignupRequestRow[]> {
  await assertSuperAdmin();

  return prisma.gymSignupRequest.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      email: true,
      contactName: true,
      gymName: true,
      gymKindSuggested: true,
      phone: true,
      expectedStudents: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      rejectedAt: true,
      completedAt: true,
      tokenExpiresAt: true,
      createdByAdminId: true,
    },
  });
}

export async function getSignupRequestDetail(
  id: string
): Promise<SignupRequestDetail> {
  await assertSuperAdmin();

  const req = await prisma.gymSignupRequest.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      email: true,
      contactName: true,
      gymName: true,
      gymKindSuggested: true,
      phone: true,
      expectedStudents: true,
      message: true,
      status: true,
      createdAt: true,
      approvedAt: true,
      rejectedAt: true,
      completedAt: true,
      onboardingToken: true,
      tokenExpiresAt: true,
      rejectionReason: true,
      gymId: true,
      createdByAdminId: true,
    },
  });

  if (!req) {
    throw new Error("Signup request no encontrada");
  }

  return req;
}

export async function approveSignupRequest(id: string): Promise<ActionResult> {
  await assertSuperAdmin();

  const req = await prisma.gymSignupRequest.findUnique({ where: { id } });
  if (!req) {
    return { success: false, error: "Request no encontrada" };
  }

  if (!canTransition(req.status, "APPROVED")) {
    return {
      success: false,
      error: `No se puede aprobar una request en estado ${req.status}`,
    };
  }

  const token = generateOnboardingToken();
  const tokenExpiresAt = computeTokenExpiresAt();

  const updated = await prisma.gymSignupRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      onboardingToken: token,
      tokenExpiresAt,
    },
  });

  try {
    await sendLeadApprovedEmail(updated);
  } catch (err) {
    console.warn("[signup-request] Failed to send lead-approved email", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { success: true };
}

export async function rejectSignupRequest(
  id: string,
  reason?: string
): Promise<ActionResult> {
  await assertSuperAdmin();

  const req = await prisma.gymSignupRequest.findUnique({ where: { id } });
  if (!req) {
    return { success: false, error: "Request no encontrada" };
  }

  if (!canTransition(req.status, "REJECTED")) {
    return {
      success: false,
      error: `No se puede rechazar una request en estado ${req.status}`,
    };
  }

  const updated = await prisma.gymSignupRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason?.trim() || null,
    },
  });

  try {
    await sendLeadRejectedEmail(updated);
  } catch (err) {
    console.warn("[signup-request] Failed to send lead-rejected email", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { success: true };
}

export async function createWhitelistEntry(input: {
  email: string;
  contactName: string;
  gymName: string;
  gymKindSuggested: "GYM" | "BOX";
  message?: string;
}): Promise<ActionResult> {
  await assertSuperAdmin();

  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Sin sesión" };
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const email = input.email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    return { success: false, error: "Email inválido" };
  }
  if (!input.contactName.trim()) {
    return { success: false, error: "Nombre de contacto requerido" };
  }
  if (!input.gymName.trim()) {
    return { success: false, error: "Nombre del gym requerido" };
  }

  const existing = await prisma.gymSignupRequest.findFirst({
    where: { email, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (existing) {
    return {
      success: false,
      error: "Ya existe una solicitud activa con ese email",
    };
  }

  const token = generateOnboardingToken();
  const tokenExpiresAt = computeTokenExpiresAt();

  const created = await prisma.gymSignupRequest.create({
    data: {
      email,
      contactName: input.contactName.trim(),
      gymName: input.gymName.trim(),
      gymKindSuggested: input.gymKindSuggested,
      message: input.message?.trim() || null,
      status: "APPROVED",
      approvedAt: new Date(),
      onboardingToken: token,
      tokenExpiresAt,
      createdByAdminId: session.user.id,
    },
  });

  try {
    await sendLeadApprovedEmail(created);
  } catch (err) {
    console.warn("[signup-request] Failed to send lead-approved email (whitelist)", {
      id: created.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { success: true };
}

export async function resendOnboardingEmail(id: string): Promise<ActionResult> {
  await assertSuperAdmin();

  const req = await prisma.gymSignupRequest.findUnique({ where: { id } });
  if (!req) {
    return { success: false, error: "Request no encontrada" };
  }

  if (req.status !== "APPROVED") {
    return {
      success: false,
      error: "Solo se puede reenviar el email a requests aprobadas",
    };
  }

  if (isTokenExpired(req)) {
    return {
      success: false,
      error: "El token expiró. Re-aprobá la request para generar uno nuevo.",
    };
  }

  try {
    await sendLeadApprovedEmail(req);
  } catch (err) {
    console.warn("[signup-request] Failed to resend lead-approved email", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: "Error al enviar el email" };
  }

  return { success: true };
}
