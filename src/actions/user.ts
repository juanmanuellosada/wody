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
