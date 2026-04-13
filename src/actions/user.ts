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

export async function createUser(formData: FormData): Promise<UserResult> {
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

  if (!name) return { success: false, error: "El nombre es obligatorio." };
  if (!email) return { success: false, error: "El email es obligatorio." };
  if (!password || password.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (role !== "TEACHER" && role !== "STUDENT") {
    return { success: false, error: "El rol debe ser Profe o Alumno." };
  }
  if (studentType !== "GENERAL" && studentType !== "PERSONALIZED") {
    return { success: false, error: "Tipo de alumno invalido." };
  }

  const hashedPassword = await hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as Role,
        studentType: (role === "STUDENT" ? studentType : "PERSONALIZED") as StudentType,
        gymId,
      },
    });

    revalidatePath(gymPath(gymSlug, "/admin"));
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

  // Cascade is handled by Prisma onDelete: Cascade on all relations
  await prisma.user.delete({ where: { id: userId } });

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

  const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
  if (!teacher || teacher.gymId !== gymId || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")) {
    return { success: false, error: "El profe no existe o no tiene el rol correcto." };
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
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
    await prisma.teacherStudent.delete({
      where: { teacherId_studentId: { teacherId, studentId } },
    });

    revalidatePath(gymPath(gymSlug, "/admin"));
    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
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

  const student = await prisma.user.findUnique({ where: { id: studentId } });
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
    // Check email uniqueness within gym
    const existing = await prisma.user.findUnique({
      where: { email_gymId: { email: trimmed, gymId } },
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

export async function toggleStudentType(userId: string): Promise<UserResult> {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.gymId !== gymId || user.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }

  const newType: StudentType =
    user.studentType === "GENERAL" ? "PERSONALIZED" : "GENERAL";

  await prisma.user.update({
    where: { id: userId },
    data: {
      studentType: newType,
      // GENERAL students can't belong to groups
      ...(newType === "GENERAL" ? { groupId: null } : {}),
    },
  });

  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  return { success: true };
}
