"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, Role, StudentType } from "@prisma/client";
import { gymPath } from "@/lib/gym";

export type UserResult =
  | { success: true }
  | { success: false; error: string };

export type CreateUserResult =
  | { success: true; memberNumber: number }
  | { success: false; error: string };

export async function createUser(formData: FormData): Promise<CreateUserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = (formData.get("password") as string | null)?.trim();
  const role = formData.get("role") as string | null;
  const studentType = (formData.get("studentType") as string | null) || "PERSONALIZED";
  const teacherIdRaw = (formData.get("teacherId") as string | null)?.trim() || null;
  const canCreateOwnRoutinesRaw = formData.get("canCreateOwnRoutines");

  if (!name) return { success: false, error: "El nombre es obligatorio." };
  if (!email) return { success: false, error: "El email es obligatorio." };
  if (!password || password.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (role !== "ADMIN" && role !== "TEACHER" && role !== "STUDENT") {
    return { success: false, error: "El rol debe ser Admin, Profe o Alumno." };
  }
  if (studentType !== "GENERAL" && studentType !== "PERSONALIZED") {
    return { success: false, error: "Tipo de alumno invalido." };
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

  const hashedPassword = await hash(password, 10);

  try {
    // Transacción: incrementa Gym.nextMemberNumber, crea el user con el
    // número anterior y (si corresponde) crea el vínculo con el profe.
    // Atómico para evitar colisiones si dos creaciones ocurren en paralelo.
    const memberNumber = await prisma.$transaction(async (tx) => {
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

    revalidatePath(gymPath(gymSlug, "/admin"));
    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    return { success: true, memberNumber };
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

export async function deleteUser(userId: string): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  if (userId === session.user.id) {
    return { success: false, error: "No podés eliminar tu propia cuenta." };
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
        ? [prisma.user.updateMany({ where: { groupId: { in: deletedGroupIds } }, data: { groupId: null } })]
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

  const gymSlug = session.user.gymSlug;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.teacherStudent.delete({
        where: { teacherId_studentId: { teacherId, studentId } },
      });
      // Si al alumno no le queda ningún profe, tiene que autogestionarse.
      const remaining = await tx.teacherStudent.count({ where: { studentId } });
      if (remaining === 0) {
        await tx.user.update({
          where: { id: studentId },
          data: { canCreateOwnRoutines: true },
        });
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

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const student = await prisma.user.findFirst({ where: { id: studentId, deletedAt: null } });
  if (!student || student.gymId !== gymId || student.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
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

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });

  if (!user || user.gymId !== gymId || user.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }

  const newType: StudentType =
    user.studentType === "GENERAL" ? "PERSONALIZED" : "GENERAL";

  await prisma.user.update({
    where: { id: userId },
    data: {
      studentType: newType,
      // GENERAL students can't belong to groups ni crear sus propias rutinas
      ...(newType === "GENERAL"
        ? { groupId: null, canCreateOwnRoutines: false }
        : {}),
    },
  });

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  return { success: true };
}

export async function promoteTeacherToAdmin(formData: FormData): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
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

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const student = await prisma.user.findFirst({
    where: { id: studentId, deletedAt: null },
    select: { gymId: true, role: true, studentType: true },
  });

  if (!student || student.gymId !== gymId || student.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
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
