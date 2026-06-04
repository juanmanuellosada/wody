"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountKind, Prisma, Role, StudentType } from "@prisma/client";
import { gymPath } from "@/lib/gym";
import { parseJoinRequestPaymentDate } from "@/lib/dates";
import { generateToken } from "@/lib/email/tokens";
import { sendEmail } from "@/lib/email/send";
import { InviteEmail } from "@/lib/email/templates/InviteEmail";
import React from "react";

export type UserResult =
  | { success: true }
  | { success: false; error: string };

export type CreateUserResult =
  | { success: true; memberNumber: number }
  | { success: true; memberNumber: number; warning: string }
  | { success: false; error: string };

/**
 * Devuelve una estimación del próximo número de socio para un gym.
 * Es MAX(memberNumber) + 1 entre filas activas. No reserva el número —
 * la transacción real de createUser usa Gym.nextMemberNumber con fallback P2002.
 */
export async function previewNextMemberNumber(gymId: string): Promise<number> {
  const row = await prisma.user.aggregate({
    where: { gymId, deletedAt: null },
    _max: { memberNumber: true },
  });
  return (row._max.memberNumber ?? 0) + 1;
}

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const mode = formData.get("mode") as string | null;
  if (mode !== "password" && mode !== "invite" && mode !== "lite") {
    return { success: false, error: "Modo inválido" };
  }

  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = (formData.get("password") as string | null)?.trim();
  const teacherIdRaw = (formData.get("teacherId") as string | null)?.trim() || null;

  if (!name) return { success: false, error: "El nombre es obligatorio." };

  // ── Flujo lite ────────────────────────────────────────────────────────────
  if (mode === "lite") {
    // Lites nacen como STUDENT/GENERAL/LITE sin email ni password.
    const liteTeacherIdToLink = teacherIdRaw;

    if (liteTeacherIdToLink) {
      const teacher = await prisma.user.findFirst({
        where: { id: liteTeacherIdToLink, deletedAt: null },
        select: { gymId: true, role: true },
      });
      if (
        !teacher ||
        teacher.gymId !== gymId ||
        (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")
      ) {
        return { success: false, error: "El profe seleccionado no es válido." };
      }
    }

    // Validar fecha de próximo pago antes de abrir cualquier transacción.
    const nextPaymentDateRaw = (formData.get("nextPaymentDate") as string | null)?.trim() || "";
    const paymentDateResult = parseJoinRequestPaymentDate(nextPaymentDateRaw);
    if (!paymentDateResult.ok) {
      // Normalizar los mensajes de error al español consistente con createUser.
      const rawError = paymentDateResult.error;
      const errorMsg = rawError.includes("obligatoria") || rawError.includes("inválid")
        ? "La fecha de próximo pago es obligatoria y debe tener formato AAAA-MM-DD"
        : rawError.includes("anterior")
        ? "La fecha de próximo pago no puede ser anterior a hoy"
        : rawError;
      return { success: false, error: errorMsg };
    }
    const parsedPaymentDate = paymentDateResult.date;

    const runLiteCreate = () =>
      prisma.$transaction(async (tx) => {
        const gym = await tx.gym.update({
          where: { id: gymId },
          data: { nextMemberNumber: { increment: 1 } },
          select: { nextMemberNumber: true },
        });
        const assigned = gym.nextMemberNumber - 1;
        const created = await tx.user.create({
          data: {
            name,
            email: null,
            password: null,
            role: "STUDENT" as Role,
            studentType: "GENERAL" as StudentType,
            accountKind: "LITE" as AccountKind,
            canCreateOwnRoutines: false,
            gymId,
            memberNumber: assigned,
            nextPaymentDate: parsedPaymentDate,
          },
        });
        if (liteTeacherIdToLink) {
          await tx.teacherStudent.create({
            data: { teacherId: liteTeacherIdToLink, studentId: created.id },
          });
        }
        return assigned;
      });

    try {
      const memberNumber = await runLiteCreate();
      revalidatePath(gymPath(gymSlug, "/admin"));
      revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
      return { success: true, memberNumber };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta as { target?: string[] | string } | undefined)?.target;
        const targetStr = Array.isArray(target) ? target.join(",") : (target ?? "");
        if (targetStr.includes("memberNumber")) {
          const maxRow = await prisma.user.aggregate({
            where: { gymId, deletedAt: null },
            _max: { memberNumber: true },
          });
          const correctNext = (maxRow._max.memberNumber ?? 0) + 1;
          await prisma.gym.update({
            where: { id: gymId },
            data: { nextMemberNumber: correctNext },
          });
          try {
            const memberNumber = await runLiteCreate();
            revalidatePath(gymPath(gymSlug, "/admin"));
            revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
            return { success: true, memberNumber };
          } catch (retryErr) {
            if (
              retryErr instanceof Prisma.PrismaClientKnownRequestError &&
              retryErr.code === "P2002"
            ) {
              return { success: false, error: "El contador de números de socio del gym estaba desincronizado y el reintento también falló. Avisá al equipo técnico." };
            }
            throw retryErr;
          }
        } else {
          return { success: false, error: `Conflicto de unicidad inesperado: ${targetStr || "constraint desconocida"}.` };
        }
      }
      throw error;
    }
  }

  // ── Flujos invite / password ──────────────────────────────────────────────
  const role = formData.get("role") as string | null;
  const studentType = (formData.get("studentType") as string | null) || "PERSONALIZED";
  const canCreateOwnRoutinesRaw = formData.get("canCreateOwnRoutines");

  if (!email) return { success: false, error: "El email es obligatorio." };
  if (mode === "password") {
    if (!password || password.length < 6) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }
  }
  if (role !== "ADMIN" && role !== "TEACHER" && role !== "STUDENT") {
    return { success: false, error: "El rol debe ser Admin, Profe o Alumno." };
  }
  if (studentType !== "GENERAL" && studentType !== "PERSONALIZED" && studentType !== "MUSCULACION_LIBRE") {
    return { success: false, error: "Tipo de alumno invalido." };
  }

  // MUSCULACION_LIBRE is only allowed for GYM kind, not BOX.
  if (studentType === "MUSCULACION_LIBRE") {
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { kind: true } });
    if (!gym || gym.kind !== "GYM") {
      return { success: false, error: "El tipo 'Musculación libre' solo está disponible en gimnasios." };
    }
  }

  // Resolve canCreateOwnRoutines + teacher link according to role/type rules.
  const isPersonalizedStudent = role === "STUDENT" && studentType === "PERSONALIZED";
  const requestedCanCreate = canCreateOwnRoutinesRaw === "1" || canCreateOwnRoutinesRaw === "true";

  let canCreateOwnRoutines = false;
  let teacherIdToLink: string | null = null;

  if (role === "TEACHER" || role === "ADMIN") {
    canCreateOwnRoutines = true;
  } else if (isPersonalizedStudent) {
    teacherIdToLink = teacherIdRaw;
    // Sin profe asignado el alumno tiene que autogestionarse.
    canCreateOwnRoutines = teacherIdToLink ? requestedCanCreate : true;
  }
  // GENERAL students: flag stays false, no teacher link at creation time.

  if (teacherIdToLink) {
    const teacher = await prisma.user.findFirst({
      where: { id: teacherIdToLink, deletedAt: null },
      select: { gymId: true, role: true },
    });
    if (
      !teacher ||
      teacher.gymId !== gymId ||
      (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")
    ) {
      return { success: false, error: "El profe seleccionado no es válido." };
    }
  }

  // Pre-check: si ya hay un User activo con ese email+gym, devolvemos info
  // diagnóstica antes de tocar la transacción. Mismo razonamiento que en
  // approveJoinRequest: el partial unique index solo aplica a deletedAt IS NULL.
  const existingUser = await prisma.user.findFirst({
    where: { email: email!, gymId, deletedAt: null },
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
      success: false,
      error: `Ya existe "${existingUser.name}" (#${existingUser.memberNumber}, ${roleLabel}, ${status}) con ese email en este gym. Buscalo en el panel: si es la misma persona, reenviale la invitación o cambiale la contraseña; si es un duplicado, eliminá el otro registro primero.`,
    };
  }

  if (mode === "password") {
    // ── Flujo con contraseña ───────────────────────────────────────────────
    const hashedPassword = await hash(password!, 10);

    const runPasswordCreate = () =>
      prisma.$transaction(async (tx) => {
        const gym = await tx.gym.update({
          where: { id: gymId },
          data: { nextMemberNumber: { increment: 1 } },
          select: { nextMemberNumber: true },
        });
        const assigned = gym.nextMemberNumber - 1;
        const created = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: role as Role,
            studentType: (role === "STUDENT" ? studentType : "PERSONALIZED") as StudentType,
            canCreateOwnRoutines,
            gymId,
            memberNumber: assigned,
          },
        });
        if (teacherIdToLink) {
          await tx.teacherStudent.create({
            data: { teacherId: teacherIdToLink, studentId: created.id },
          });
        }
        return assigned;
      });

    try {
      const memberNumber = await runPasswordCreate();
      revalidatePath(gymPath(gymSlug, "/admin"));
      revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
      return { success: true, memberNumber };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta as { target?: string[] | string } | undefined)?.target;
        const targetStr = Array.isArray(target) ? target.join(",") : (target ?? "");
        if (targetStr.includes("memberNumber")) {
          const maxRow = await prisma.user.aggregate({
            where: { gymId, deletedAt: null },
            _max: { memberNumber: true },
          });
          const correctNext = (maxRow._max.memberNumber ?? 0) + 1;
          await prisma.gym.update({
            where: { id: gymId },
            data: { nextMemberNumber: correctNext },
          });
          try {
            const memberNumber = await runPasswordCreate();
            revalidatePath(gymPath(gymSlug, "/admin"));
            revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
            return { success: true, memberNumber };
          } catch (retryErr) {
            if (
              retryErr instanceof Prisma.PrismaClientKnownRequestError &&
              retryErr.code === "P2002"
            ) {
              return { success: false, error: "El contador de números de socio del gym estaba desincronizado y el reintento también falló. Avisá al equipo técnico." };
            }
            throw retryErr;
          }
        } else if (targetStr.includes("email")) {
          return { success: false, error: "Ya existe un usuario con ese email en este gym (creado en paralelo). Recargá la página." };
        } else {
          return { success: false, error: `Conflicto de unicidad inesperado: ${targetStr || "constraint desconocida"}.` };
        }
      }
      throw error;
    }
  }

  // ── Flujo por invitación ─────────────────────────────────────────────────
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let memberNumber: number;

  const runInviteCreate = () =>
    // Transacción: incrementa Gym.nextMemberNumber, crea User (sin password) y
    // VerificationToken INVITE. Atómico para evitar colisiones en paralelo.
    prisma.$transaction(async (tx) => {
      const gym = await tx.gym.update({
        where: { id: gymId },
        data: { nextMemberNumber: { increment: 1 } },
        select: { nextMemberNumber: true },
      });
      const assigned = gym.nextMemberNumber - 1;
      const created = await tx.user.create({
        data: {
          name,
          email,
          password: null,
          emailVerifiedAt: null,
          role: role as Role,
          studentType: (role === "STUDENT" ? studentType : "PERSONALIZED") as StudentType,
          canCreateOwnRoutines,
          gymId,
          memberNumber: assigned,
        },
      });
      if (teacherIdToLink) {
        await tx.teacherStudent.create({
          data: { teacherId: teacherIdToLink, studentId: created.id },
        });
      }
      await tx.verificationToken.create({
        data: {
          userId: created.id,
          tokenHash: token.hash,
          type: "INVITE",
          expiresAt,
          consumedAt: null,
        },
      });
      return assigned;
    });

  try {
    memberNumber = await runInviteCreate();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta as { target?: string[] | string } | undefined)?.target;
      const targetStr = Array.isArray(target) ? target.join(",") : (target ?? "");
      if (targetStr.includes("memberNumber")) {
        const maxRow = await prisma.user.aggregate({
          where: { gymId, deletedAt: null },
          _max: { memberNumber: true },
        });
        const correctNext = (maxRow._max.memberNumber ?? 0) + 1;
        await prisma.gym.update({
          where: { id: gymId },
          data: { nextMemberNumber: correctNext },
        });
        try {
          memberNumber = await runInviteCreate();
        } catch (retryErr) {
          if (
            retryErr instanceof Prisma.PrismaClientKnownRequestError &&
            retryErr.code === "P2002"
          ) {
            return { success: false, error: "El contador de números de socio del gym estaba desincronizado y el reintento también falló. Avisá al equipo técnico." };
          }
          throw retryErr;
        }
      } else if (targetStr.includes("email")) {
        return { success: false, error: "Ya existe un usuario con ese email en este gym (creado en paralelo). Recargá la página." };
      } else {
        return { success: false, error: `Conflicto de unicidad inesperado: ${targetStr || "constraint desconocida"}.` };
      }
    } else {
      throw error;
    }
  }

  // Fuera de la transacción: cargar gym para el template y enviar el mail.
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true, primaryColor: true, logo: true, kind: true },
  });
  if (!gym) {
    // No debería ocurrir, pero por robustez retornamos éxito con warning.
    revalidatePath(gymPath(gymSlug, "/admin"));
    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    return {
      success: true,
      memberNumber,
      warning: "Usuario creado pero el mail de invitación no se pudo enviar — usá Reenviar invitación",
    };
  }

  const activationUrl = `${process.env.APP_URL}/${gymSlug}/activar?token=${token.plain}`;

  const emailResult = await sendEmail({
    to: email,
    gymId,
    type: "INVITE",
    subject: `Activá tu cuenta en ${gym.name}`,
    react: React.createElement(InviteEmail, {
      gym,
      recipientName: name,
      activationUrl,
      expiresAt,
    }),
  });

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));

  if (!emailResult.ok) {
    return {
      success: true,
      memberNumber,
      warning: "Usuario creado pero el mail de invitación no se pudo enviar — usá Reenviar invitación",
    };
  }

  return { success: true, memberNumber };
}

export async function deleteUser(userId: string): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (userId === session.user.id) {
    return { success: false, error: "No podés eliminar tu propia cuenta." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.gymId !== gymId) {
    return { success: false, error: "Usuario no encontrado." };
  }

  // Idempotencia: si ya está borrado, no rehacemos la cascada.
  if (user.deletedAt !== null) {
    return { success: true };
  }

  const now = new Date();

  if (user.role === "TEACHER" || user.role === "ADMIN") {
    // Capturar IDs de grupos activos del profe ANTES de soft-deletarlos,
    // para luego nullear el groupId de los alumnos que apuntaban a esos grupos.
    const activeGroups = await prisma.group.findMany({
      where: { teacherId: userId, deletedAt: null },
      select: { id: true },
    });
    const deletedGroupIds = activeGroups.map((g) => g.id);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deletedAt: now } }),
      prisma.group.updateMany({ where: { teacherId: userId, deletedAt: null }, data: { deletedAt: now } }),
      prisma.wod.updateMany({ where: { teacherId: userId, deletedAt: null }, data: { deletedAt: now } }),
      prisma.teacherStudent.deleteMany({ where: { OR: [{ teacherId: userId }, { studentId: userId }] } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.accessLog.updateMany({ where: { decidedById: userId }, data: { decidedById: null } }),
      ...(deletedGroupIds.length > 0
        ? [prisma.groupMember.deleteMany({ where: { groupId: { in: deletedGroupIds } } })]
        : []),
    ]);
  } else {
    // STUDENT o ACCESS
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { deletedAt: now } }),
      prisma.teacherStudent.deleteMany({ where: { studentId: userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.wod.updateMany({ where: { targetStudentId: userId, deletedAt: null }, data: { targetStudentId: null } }),
      prisma.accessLog.updateMany({ where: { decidedById: userId }, data: { decidedById: null } }),
    ]);
  }

  revalidatePath(gymPath(gymSlug, "/admin"));
  return { success: true };
}

export async function assignStudent(
  teacherId: string,
  studentId: string
): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const teacher = await prisma.user.findFirst({ where: { id: teacherId, deletedAt: null } });
  if (!teacher || teacher.gymId !== gymId || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")) {
    return { success: false, error: "El profe no existe o no tiene el rol correcto." };
  }

  const student = await prisma.user.findFirst({ where: { id: studentId, deletedAt: null } });
  if (!student || student.gymId !== gymId || student.role !== "STUDENT") {
    return { success: false, error: "El alumno no existe o no tiene el rol correcto." };
  }

  try {
    await prisma.teacherStudent.create({
      data: { teacherId, studentId },
    });

    revalidatePath(gymPath(gymSlug, "/admin"));
    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Ese alumno ya está asignado a ese profe." };
    }
    throw error;
  }
}

export async function unassignStudent(
  teacherId: string,
  studentId: string
): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymSlug = session.user.gymSlug;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.teacherStudent.delete({
        where: { teacherId_studentId: { teacherId, studentId } },
      });
      // Si al alumno no le queda ningún profe, tiene que autogestionarse.
      // Los lites nunca usan la app, así que su flag queda siempre en false.
      const remaining = await tx.teacherStudent.count({ where: { studentId } });
      if (remaining === 0) {
        const target = await tx.user.findUnique({
          where: { id: studentId },
          select: { accountKind: true },
        });
        if (target?.accountKind !== "LITE") {
          await tx.user.update({
            where: { id: studentId },
            data: { canCreateOwnRoutines: true },
          });
        }
      }
    });

    revalidatePath(gymPath(gymSlug, "/admin"));
    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { success: false, error: "La asignación no existe." };
    }
    throw error;
  }
}

export async function updateStudent(
  studentId: string,
  data: { name?: string; email?: string; password?: string }
): Promise<UserResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const student = await prisma.user.findFirst({ where: { id: studentId, deletedAt: null } });
  if (!student || student.gymId !== gymId || student.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }

  // Los lites no pueden recibir email/password por esta vía — usar upgradeLiteUser.
  if (student.accountKind === "LITE" && (data.email !== undefined || data.password !== undefined)) {
    return {
      success: false,
      error: "Para asignar email o contraseña a un alumno lite hay que usar el flujo de conversión a cuenta completa.",
    };
  }

  // Teachers can only edit their own students
  if (session.user.role === "TEACHER") {
    const link = await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId: session.user.id, studentId } },
    });
    if (!link) {
      return { success: false, error: "Este alumno no está asignado a vos." };
    }
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) return { success: false, error: "El nombre no puede estar vacío." };
    updateData.name = trimmed;
  }

  if (data.email !== undefined) {
    const trimmed = data.email.trim().toLowerCase();
    if (!trimmed) return { success: false, error: "El email no puede estar vacío." };
    // Check email uniqueness within gym (only active users)
    const existing = await prisma.user.findFirst({
      where: { email: trimmed, gymId, deletedAt: null },
    });
    if (existing && existing.id !== studentId) {
      return { success: false, error: "Ya existe un usuario con ese email en este gym." };
    }
    updateData.email = trimmed;
  }

  if (data.password !== undefined) {
    const trimmed = data.password.trim();
    if (trimmed.length < 6) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }
    updateData.password = await hash(trimmed, 10);
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "No hay cambios para guardar." };
  }

  try {
    await prisma.user.update({ where: { id: studentId }, data: updateData });
    revalidatePath(gymPath(gymSlug, "/admin"));
    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Ya existe un usuario con ese email en este gym." };
    }
    throw error;
  }
}

export async function setUserBlocked(
  userId: string,
  blocked: boolean
): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (userId === session.user.id) {
    return { success: false, error: "No podés bloquear tu propia cuenta." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user || user.gymId !== gymId) {
    return { success: false, error: "Usuario no encontrado." };
  }

  if (user.role === "ADMIN") {
    return { success: false, error: "No se pueden bloquear administradores." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { blockedAt: blocked ? new Date() : null },
  });

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/pagos"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  return { success: true };
}

export async function toggleStudentType(userId: string): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });

  if (!user || user.gymId !== gymId || user.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }

  if (user.accountKind === "LITE") {
    return { success: false, error: "El tipo de alumno no aplica a alumnos lite. Convertilo a cuenta completa primero." };
  }

  const newType: StudentType =
    user.studentType === "GENERAL" ? "PERSONALIZED" : "GENERAL";

  if (newType === "GENERAL") {
    // GENERAL students can't belong to groups ni crear sus propias rutinas
    await prisma.$transaction([
      prisma.groupMember.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { studentType: newType, canCreateOwnRoutines: false },
      }),
    ]);
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { studentType: newType },
    });
  }

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  return { success: true };
}

// Sets the studentType to an explicit value. Supports MUSCULACION_LIBRE for GYM-kind gyms.
// Used from the StudentEditor when the gym is kind=GYM.
export async function setStudentType(
  userId: string,
  newType: StudentType
): Promise<UserResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { kind: true } });

  // MUSCULACION_LIBRE is GYM-only
  if (newType === "MUSCULACION_LIBRE" && gym?.kind !== "GYM") {
    return { success: false, error: "El tipo musculación libre solo está disponible en gimnasios tradicionales." };
  }

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });

  if (!user || user.gymId !== gymId || user.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }

  if (user.accountKind === "LITE") {
    return { success: false, error: "El tipo de alumno no aplica a alumnos lite. Convertilo a cuenta completa primero." };
  }

  // GENERAL and MUSCULACION_LIBRE can't belong to groups or have canCreateOwnRoutines
  if (newType === "GENERAL" || newType === "MUSCULACION_LIBRE") {
    await prisma.$transaction([
      prisma.groupMember.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { studentType: newType, canCreateOwnRoutines: false },
      }),
    ]);
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { studentType: newType },
    });
  }

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true };
}

export async function promoteTeacherToAdmin(formData: FormData): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const userId = (formData.get("userId") as string | null)?.trim();
  if (!userId) {
    return { success: false, error: "El usuario es obligatorio." };
  }

  const target = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!target) {
    return { success: false, error: "Usuario no encontrado." };
  }

  if (target.gymId !== gymId) {
    return { success: false, error: "Usuario no encontrado." };
  }

  if (target.role !== "TEACHER") {
    return { success: false, error: "El usuario no tiene el rol de profe." };
  }

  if (target.blockedAt !== null) {
    return { success: false, error: "El usuario está bloqueado, desbloquealo primero." };
  }

  if (target.id === session.user.id) {
    return { success: false, error: "No podés promoverte a vos mismo." };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { role: "ADMIN" },
  });

  revalidatePath(gymPath(gymSlug, "/admin"));
  return { success: true };
}

export async function setCanCreateOwnRoutines(
  studentId: string,
  value: boolean
): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const student = await prisma.user.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { gymId: true, role: true, studentType: true, accountKind: true },
  });

  if (!student || student.gymId !== gymId || student.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }

  if (student.accountKind === "LITE") {
    return {
      success: false,
      error: "La opción de rutinas propias no aplica a alumnos lite. Convertilo a cuenta completa primero.",
    };
  }

  if (student.studentType !== "PERSONALIZED") {
    return {
      success: false,
      error: "Solo alumnos personalizados pueden autogestionar rutinas.",
    };
  }

  // Si no tiene profe asignado, el flag tiene que quedar en true.
  if (!value) {
    const linkCount = await prisma.teacherStudent.count({
      where: { studentId },
    });
    if (linkCount === 0) {
      return {
        success: false,
        error: "El alumno no tiene profe asignado: no podés desactivarlo.",
      };
    }
  }

  await prisma.user.update({
    where: { id: studentId },
    data: { canCreateOwnRoutines: value },
  });

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true };
}

export async function setStudentPaymentExempt(
  studentId: string,
  exempt: boolean,
  reason: string | null
): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const student = await prisma.user.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { gymId: true, role: true },
  });

  if (!student || student.gymId !== gymId) {
    return { success: false, error: "Alumno no encontrado." };
  }

  if (student.role !== "STUDENT") {
    return { success: false, error: "Solo se puede marcar como exento a un alumno." };
  }

  const normalizedReason = reason?.trim() || null;

  await prisma.user.update({
    where: { id: studentId },
    data: { paymentExempt: exempt, paymentExemptReason: normalizedReason },
  });

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/pagos"));
  return { success: true };
}

export async function resendInvitation(userId: string): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const callerGymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { gym: { select: { id: true, slug: true, name: true, primaryColor: true, logo: true, kind: true } } },
  });

  if (!user || user.deletedAt !== null) {
    return { success: false, error: "Usuario no encontrado." };
  }

  // Multi-tenant check: caller must belong to the same gym.
  if (user.gymId !== callerGymId) {
    return { success: false, error: "Usuario no encontrado." };
  }

  // Solo aplica a usuarios con email (los lites no tienen invitación).
  if (!user.email) {
    return { success: false, error: "Este usuario es lite (sin email) y no puede recibir invitaciones. Usá el flujo de conversión a cuenta completa." };
  }

  // Only resend to users that haven't activated yet.
  if (user.password !== null) {
    return { success: false, error: "Este usuario ya activó su cuenta." };
  }

  // Invalidate any existing INVITE tokens for this user.
  await prisma.verificationToken.updateMany({
    where: { userId, type: "INVITE", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: {
      userId,
      tokenHash: token.hash,
      type: "INVITE",
      expiresAt,
      consumedAt: null,
    },
  });

  const activationUrl = `${process.env.APP_URL}/${gymSlug}/activar?token=${token.plain}`;

  if (!user.gym || !user.gymId) {
    return { success: false, error: "Usuario no encontrado." };
  }

  const emailResult = await sendEmail({
    to: user.email!, // narrowed above: email is not null here
    gymId: user.gymId,
    type: "INVITE",
    subject: `Activá tu cuenta en ${user.gym.name}`,
    react: React.createElement(InviteEmail, {
      gym: user.gym,
      recipientName: user.name,
      activationUrl,
      expiresAt,
    }),
  });

  if (!emailResult.ok) {
    return { success: false, error: "No se pudo enviar el mail de invitación. Intentá de nuevo." };
  }

  revalidatePath(gymPath(gymSlug, "/admin"));
  return { success: true };
}

export type UpgradeLitePayload = {
  mode: "invite" | "password";
  email: string;
  password?: string;
  studentType: "GENERAL" | "PERSONALIZED";
  canCreateOwnRoutines?: boolean;
};

export async function upgradeLiteUser(
  userId: string,
  payload: UpgradeLitePayload
): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const { mode, studentType, canCreateOwnRoutines: requestedCanCreate } = payload;
  const email = payload.email.trim().toLowerCase();
  const password = payload.password?.trim();

  if (!email) {
    return { success: false, error: "El email es obligatorio." };
  }
  if (mode === "password") {
    if (!password || password.length < 6) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }
  }
  if (studentType !== "GENERAL" && studentType !== "PERSONALIZED") {
    return { success: false, error: "Tipo de alumno inválido." };
  }

  // Pre-check de colisión de email (mismo patrón que createUser).
  const existingUser = await prisma.user.findFirst({
    where: { email, gymId, deletedAt: null },
    select: {
      id: true,
      name: true,
      memberNumber: true,
      role: true,
      password: true,
      blockedAt: true,
    },
  });
  if (existingUser && existingUser.id !== userId) {
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
      success: false,
      error: `Ya existe una cuenta ${status} ("${existingUser.name}", #${existingUser.memberNumber}, ${roleLabel}) con ese email en este gym.`,
    };
  }

  // Resolver canCreateOwnRoutines final.
  const teacherCount = await prisma.teacherStudent.count({ where: { studentId: userId } });
  let resolvedCanCreate = false;
  if (studentType === "PERSONALIZED") {
    if (teacherCount === 0) {
      resolvedCanCreate = true; // sin profe: se autogestiona
    } else {
      resolvedCanCreate = requestedCanCreate ?? false;
    }
  }
  // studentType === "GENERAL": resolvedCanCreate stays false

  if (mode === "password") {
    const hashedPassword = await hash(password!, 10);

    try {
      await prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: { accountKind: true, gymId: true, deletedAt: true },
        });
        if (!target || target.deletedAt !== null || target.gymId !== gymId) {
          throw new Error("USUARIO_NO_ENCONTRADO");
        }
        if (target.accountKind !== "LITE") {
          throw new Error("NO_ES_LITE");
        }
        await tx.user.update({
          where: { id: userId },
          data: {
            email,
            password: hashedPassword,
            emailVerifiedAt: new Date(),
            accountKind: "FULL",
            studentType: studentType as StudentType,
            canCreateOwnRoutines: resolvedCanCreate,
          },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "NO_ES_LITE") {
        return { success: false, error: "El usuario no es lite, no aplica conversión." };
      }
      if (err instanceof Error && err.message === "USUARIO_NO_ENCONTRADO") {
        return { success: false, error: "Usuario no encontrado." };
      }
      throw err;
    }

    revalidatePath(gymPath(gymSlug, "/admin"));
    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    return { success: true };
  }

  // mode === "invite"
  const inviteToken = generateToken();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { accountKind: true, gymId: true, deletedAt: true },
      });
      if (!target || target.deletedAt !== null || target.gymId !== gymId) {
        throw new Error("USUARIO_NO_ENCONTRADO");
      }
      if (target.accountKind !== "LITE") {
        throw new Error("NO_ES_LITE");
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          email,
          password: null,
          emailVerifiedAt: null,
          accountKind: "FULL",
          studentType: studentType as StudentType,
          canCreateOwnRoutines: resolvedCanCreate,
        },
      });
      await tx.verificationToken.create({
        data: {
          userId,
          tokenHash: inviteToken.hash,
          type: "INVITE",
          expiresAt: inviteExpiresAt,
          consumedAt: null,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_ES_LITE") {
      return { success: false, error: "El usuario no es lite, no aplica conversión." };
    }
    if (err instanceof Error && err.message === "USUARIO_NO_ENCONTRADO") {
      return { success: false, error: "Usuario no encontrado." };
    }
    throw err;
  }

  const upgradeGymData = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true, primaryColor: true, logo: true, kind: true },
  });

  const upgradedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const activationUrl = `${process.env.APP_URL}/${gymSlug}/activar?token=${inviteToken.plain}`;

  if (upgradeGymData) {
    await sendEmail({
      to: email,
      gymId,
      type: "INVITE",
      subject: `Activá tu cuenta en ${upgradeGymData.name}`,
      react: React.createElement(InviteEmail, {
        gym: upgradeGymData as { name: string; primaryColor: string | null; logo: string | null; kind: "GYM" | "BOX" | "PERSONAL" },
        recipientName: upgradedUser?.name ?? "",
        activationUrl,
        expiresAt: inviteExpiresAt,
      }),
    });
  }

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  return { success: true };
}
