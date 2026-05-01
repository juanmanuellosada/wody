"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { gymPath } from "@/lib/gym";
import { sendEmail } from "@/lib/email/send";
import { JoinApprovedEmail } from "@/lib/email/templates/JoinApprovedEmail";
import React from "react";

type JoinResult = { ok: true } | { ok: false; error: string };

// ── 3.1 — submitJoinRequest ────────────────────────────────────────────────────

export async function submitJoinRequest({
  gymSlug,
  name,
  email,
  password,
  passwordConfirmation,
  teacherId,
  honeypot,
}: {
  gymSlug: string;
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  teacherId?: string | null;
  honeypot?: string;
}): Promise<JoinResult> {
  // Honeypot: silently succeed so the bot gets no signal.
  if (honeypot && honeypot.trim().length > 0) return { ok: true };

  // Gym validation: silently succeed on unknown gym (anti-enumeration).
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) return { ok: true };

  // Input validations — return specific errors so the legitimate user gets feedback.
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "El nombre es obligatorio" };
  if (trimmedName.length > 200) return { ok: false, error: "El nombre es demasiado largo" };

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "Email inválido" };
  }

  if (password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }

  if (password !== passwordConfirmation) {
    return { ok: false, error: "Las contraseñas no coinciden" };
  }

  if (teacherId) {
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { gymId: true, role: true, deletedAt: true },
    });
    if (
      !teacher ||
      teacher.gymId !== gym.id ||
      (teacher.role !== "TEACHER" && teacher.role !== "ADMIN") ||
      teacher.deletedAt !== null
    ) {
      return { ok: false, error: "Profe inválido" };
    }
  }

  // Anti-enumeration: silently succeed if email already exists.
  const existingUser = await prisma.user.findFirst({
    where: { email: normalizedEmail, gymId: gym.id, deletedAt: null },
    select: { id: true },
  });
  if (existingUser) return { ok: true };

  const existingPending = await prisma.joinRequest.findFirst({
    where: { email: normalizedEmail, gymId: gym.id, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) return { ok: true };

  // Hash password and create the request.
  const passwordHash = await hash(password, 10);

  await prisma.joinRequest.create({
    data: {
      gymId: gym.id,
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      teacherId: teacherId ?? null,
      status: "PENDING",
    },
  });

  revalidatePath(gymPath(gymSlug, "/admin/invitaciones"));

  return { ok: true };
}

// ── 3.2 — approveJoinRequest ──────────────────────────────────────────────────

export async function approveJoinRequest({
  requestId,
}: {
  requestId: string;
}): Promise<JoinResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "No autorizado." };
  }

  const request = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    include: { gym: true },
  });

  if (!request) return { ok: false, error: "Solicitud no encontrada" };

  if (request.gymId !== session.user.gymId) {
    return { ok: false, error: "No autorizado." };
  }

  if (request.status !== "PENDING") {
    return { ok: false, error: "Esta solicitud ya fue procesada" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Auto-increment memberNumber from the gym counter (same pattern as createUser).
      const updatedGym = await tx.gym.update({
        where: { id: request.gymId },
        data: { nextMemberNumber: { increment: 1 } },
        select: { nextMemberNumber: true },
      });
      const memberNumber = updatedGym.nextMemberNumber - 1;

      const created = await tx.user.create({
        data: {
          name: request.name,
          email: request.email,
          password: request.passwordHash,
          role: "STUDENT",
          gymId: request.gymId,
          memberNumber,
          emailVerifiedAt: new Date(),
        },
      });

      // Teacher link goes through TeacherStudent (many-to-many), not User.teacherId.
      if (request.teacherId) {
        await tx.teacherStudent.create({
          data: { teacherId: request.teacherId, studentId: created.id },
        });
      }

      await tx.joinRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: session.user.id,
        },
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Ya existe un usuario con ese email en el gym. Rechazá la solicitud manualmente.",
      };
    }
    throw e;
  }

  // Send approval mail after the transaction commits. If it fails, the user
  // already exists and the request is already APPROVED — don't block the result.
  const loginUrl = `${process.env.APP_URL ?? "https://www.wody.com.ar"}/${request.gym.slug}/login`;

  await sendEmail({
    to: request.email,
    gymId: request.gymId,
    type: "JOIN_APPROVED",
    subject: `Cuenta aprobada en ${request.gym.name}`,
    react: React.createElement(JoinApprovedEmail, {
      gym: request.gym,
      recipientName: request.name,
      loginUrl,
    }),
  });

  revalidatePath(gymPath(request.gym.slug, "/admin/invitaciones"));

  return { ok: true };
}

// ── 3.3 — rejectJoinRequest ───────────────────────────────────────────────────

export async function rejectJoinRequest({
  requestId,
}: {
  requestId: string;
}): Promise<JoinResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "No autorizado." };
  }

  const request = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    include: { gym: { select: { slug: true } } },
  });

  if (!request) return { ok: false, error: "Solicitud no encontrada" };

  if (request.gymId !== session.user.gymId) {
    return { ok: false, error: "No autorizado." };
  }

  if (request.status !== "PENDING") {
    return { ok: false, error: "Esta solicitud ya fue procesada" };
  }

  await prisma.joinRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: session.user.id,
    },
  });

  revalidatePath(gymPath(request.gym.slug, "/admin/invitaciones"));

  return { ok: true };
}
