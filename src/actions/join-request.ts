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
  teacherIds,
  honeypot,
}: {
  gymSlug: string;
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  teacherIds?: string[];
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

  const validTeacherIds: string[] = [];
  if (teacherIds && teacherIds.length > 0) {
    const validTeachers = await prisma.user.findMany({
      where: {
        id: { in: teacherIds },
        gymId: gym.id,
        deletedAt: null,
        role: { in: ["TEACHER", "ADMIN"] },
      },
      select: { id: true },
    });
    if (validTeachers.length !== teacherIds.length) {
      return { ok: false, error: "Profe inválido" };
    }
    validTeacherIds.push(...validTeachers.map((t) => t.id));
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
      status: "PENDING",
      teachers: validTeacherIds.length > 0
        ? { create: validTeacherIds.map((id) => ({ teacherId: id })) }
        : undefined,
    },
  });

  revalidatePath(gymPath(gymSlug, "/admin/invitaciones"));

  return { ok: true };
}

// ── 3.2 — approveJoinRequest ──────────────────────────────────────────────────

// Overrides the admin may supply when approving a join request.
// Email and password are intentionally absent: they are never overrideable.
type ApproveOverrides = {
  name?: string;
  studentType?: "GENERAL" | "PERSONALIZED";
  teacherIds?: string[];
  canCreateOwnRoutines?: boolean;
};

// Regla heredada de createUser (src/actions/user.ts:60-74).
// Si esa regla cambia, actualizar también aquí.
export async function approveJoinRequest({
  requestId,
  overrides,
}: {
  requestId: string;
  overrides?: ApproveOverrides;
}): Promise<JoinResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "No autorizado." };
  }

  const request = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    include: { gym: true, teachers: { select: { teacherId: true } } },
  });

  if (!request) return { ok: false, error: "Solicitud no encontrada" };

  if (request.gymId !== session.user.gymId) {
    return { ok: false, error: "No autorizado." };
  }

  if (request.status !== "PENDING") {
    return { ok: false, error: "Esta solicitud ya fue procesada" };
  }

  // Whitelist defensiva: leer explícitamente los 4 campos permitidos, ignorar el resto.
  const safeOverrides = overrides
    ? {
        name: overrides.name,
        studentType: overrides.studentType,
        teacherIds: overrides.teacherIds,
        canCreateOwnRoutines: overrides.canCreateOwnRoutines,
      }
    : undefined;

  // Resolver los campos finales aplicando la regla heredada de createUser.
  const studentType = safeOverrides?.studentType ?? "PERSONALIZED";
  const isPersonalizedStudent = studentType === "PERSONALIZED";

  // If overrides include teacherIds (even empty array), use that; otherwise fall back to request's teachers.
  const resolvedTeacherIds: string[] = isPersonalizedStudent
    ? (safeOverrides?.teacherIds !== undefined
        ? safeOverrides.teacherIds
        : request.teachers.map((t) => t.teacherId))
    : [];

  const requestedCanCreate = safeOverrides?.canCreateOwnRoutines ?? false;
  const canCreateOwnRoutines = isPersonalizedStudent
    ? (resolvedTeacherIds.length > 0 ? requestedCanCreate : true)
    : false;
  const finalName = safeOverrides?.name ?? request.name;

  // Validar cada teacherId cuando hay profes a vincular.
  if (resolvedTeacherIds.length > 0) {
    const validTeachers = await prisma.user.findMany({
      where: {
        id: { in: resolvedTeacherIds },
        gymId: request.gymId,
        deletedAt: null,
        role: { in: ["TEACHER", "ADMIN"] },
      },
      select: { id: true },
    });
    if (validTeachers.length !== resolvedTeacherIds.length) {
      return { ok: false, error: "Profe inválido" };
    }
  }

  // Pre-check: si ya hay un User activo con ese email+gym, no entramos a la
  // transacción y devolvemos info diagnóstica. El partial unique index sólo
  // aplica a filas con deletedAt IS NULL, así que ese es el único caso que
  // puede gatillar P2002.
  const existingUser = await prisma.user.findFirst({
    where: { email: request.email, gymId: request.gymId, deletedAt: null },
    select: {
      name: true,
      memberNumber: true,
      role: true,
      password: true,
      blockedAt: true,
    },
  });
  if (existingUser) {
    const status = existingUser.password === null
      ? "invitación pendiente de activar"
      : existingUser.blockedAt !== null
        ? "bloqueado"
        : "activo";
    const roleLabel = existingUser.role === "STUDENT"
      ? "alumno"
      : existingUser.role === "TEACHER"
        ? "profe"
        : existingUser.role === "ADMIN"
          ? "admin"
          : "acceso";
    return {
      ok: false,
      error: `Ya existe un usuario con ese email en el gym: "${existingUser.name}" (#${existingUser.memberNumber}, ${roleLabel}, ${status}). Si es la misma persona, rechazá esta solicitud; si es un duplicado, eliminá el otro registro desde el panel y volvé a aprobar.`,
    };
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
          name: finalName,
          email: request.email,
          password: request.passwordHash,
          role: "STUDENT",
          studentType,
          canCreateOwnRoutines,
          gymId: request.gymId,
          memberNumber,
          emailVerifiedAt: new Date(),
        },
      });

      // Teacher links go through TeacherStudent (many-to-many), one entry per teacher.
      for (const teacherId of resolvedTeacherIds) {
        await tx.teacherStudent.create({
          data: { teacherId, studentId: created.id },
        });
      }

      // Update JoinRequestTeacher entries to reflect final teacher list.
      if (safeOverrides?.teacherIds !== undefined) {
        await tx.joinRequestTeacher.deleteMany({ where: { joinRequestId: request.id } });
        if (resolvedTeacherIds.length > 0) {
          await tx.joinRequestTeacher.createMany({
            data: resolvedTeacherIds.map((id) => ({ joinRequestId: request.id, teacherId: id })),
          });
        }
      }

      await tx.joinRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: session.user.id,
          name: finalName,
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
  const appUrl = process.env.APP_URL ?? "https://www.wody.com.ar";
  const loginUrl = `${appUrl}/${request.gym.slug}/login`;
  const installUrl = `${appUrl}/${request.gym.slug}/instalar`;

  await sendEmail({
    to: request.email,
    gymId: request.gymId,
    type: "JOIN_APPROVED",
    subject: `Cuenta aprobada en ${request.gym.name}`,
    react: React.createElement(JoinApprovedEmail, {
      gym: request.gym,
      recipientName: finalName,
      loginUrl,
      installUrl,
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
