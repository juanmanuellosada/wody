"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { gymPath } from "@/lib/gym";

export type GroupResult =
  | { success: true; groupId?: string }
  | { success: false; error: string };

export async function createGroup(name: string): Promise<GroupResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "El nombre del grupo no puede estar vacío." };
  }

  try {
    const group = await prisma.group.create({
      data: { name: trimmed, teacherId },
    });

    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    revalidatePath(gymPath(gymSlug, "/admin"));
    return { success: true, groupId: group.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Ya tenés un grupo con ese nombre." };
    }
    throw error;
  }
}

export async function renameGroup(
  groupId: string,
  name: string
): Promise<GroupResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;

  const group = await prisma.group.findUnique({ where: { id: groupId } });

  if (!group || (group.teacherId !== teacherId && session.user.role !== "ADMIN")) {
    return { success: false, error: "Grupo no encontrado." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "El nombre del grupo no puede estar vacío." };
  }

  try {
    await prisma.group.update({
      where: { id: groupId },
      data: { name: trimmed },
    });

    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    revalidatePath(gymPath(gymSlug, "/admin"));
    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { success: false, error: "Ya existe un grupo con ese nombre." };
    }
    throw error;
  }
}

export async function deleteGroup(groupId: string): Promise<GroupResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;

  const group = await prisma.group.findUnique({ where: { id: groupId } });

  if (!group || (group.teacherId !== teacherId && session.user.role !== "ADMIN")) {
    return { success: false, error: "Grupo no encontrado." };
  }

  await prisma.group.delete({ where: { id: groupId } });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/admin"));
  return { success: true };
}

export async function assignStudentToGroup(
  studentId: string,
  groupId: string
): Promise<GroupResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || (group.teacherId !== teacherId && session.user.role !== "ADMIN")) {
    return { success: false, error: "Grupo no encontrado." };
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }
  if (student.studentType !== "PERSONALIZED") {
    return { success: false, error: "Solo alumnos personalizados pueden pertenecer a un grupo." };
  }

  // Verify the student is assigned to this teacher (or admin can assign any)
  if (session.user.role !== "ADMIN") {
    const link = await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId, studentId } },
    });
    if (!link) {
      return { success: false, error: "Este alumno no está asignado a vos." };
    }
  }

  await prisma.user.update({
    where: { id: studentId },
    data: { groupId },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/admin"));
  return { success: true };
}

export async function removeStudentFromGroup(
  studentId: string
): Promise<GroupResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return { success: false, error: "Alumno no encontrado." };
  }

  if (session.user.role !== "ADMIN") {
    const link = await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId, studentId } },
    });
    if (!link) {
      return { success: false, error: "Este alumno no está asignado a vos." };
    }
  }

  await prisma.user.update({
    where: { id: studentId },
    data: { groupId: null },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/admin"));
  return { success: true };
}
