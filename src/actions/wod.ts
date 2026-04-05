"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { Prisma } from "@prisma/client";

export type WodResult =
  | { success: true; wodId?: string }
  | { success: false; error: string };

async function teacherOwnsStudent(
  teacherId: string,
  studentId: string,
  gymId: string
): Promise<boolean> {
  const link = await prisma.teacherStudent.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
    include: {
      teacher: { select: { gymId: true } },
      student: { select: { gymId: true } },
    },
  });
  return (
    link !== null &&
    link.teacher.gymId === gymId &&
    link.student.gymId === gymId
  );
}

export async function createWod(
  studentId: string,
  date: string,
  content: string
): Promise<WodResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymId, gymSlug } = session.user;

  if (!(await teacherOwnsStudent(teacherId, studentId, gymId))) {
    return { success: false, error: "Este alumno no esta asignado a vos." };
  }

  if (!content.trim()) {
    return { success: false, error: "El contenido del WOD no puede estar vacio." };
  }

  const wodDate = new Date(date + "T00:00:00.000Z");

  try {
    const wod = await prisma.wod.create({
      data: {
        content,
        date: wodDate,
        studentId,
        teacherId,
      },
    });

    revalidatePath(gymPath(gymSlug, `/dashboard/teacher/${studentId}`));
    revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
    return { success: true, wodId: wod.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Ya existe un WOD para ese alumno en esa fecha.",
      };
    }
    throw error;
  }
}

export async function updateWod(
  wodId: string,
  content: string
): Promise<WodResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymId, gymSlug } = session.user;

  const wod = await prisma.wod.findUnique({
    where: { id: wodId },
    include: { student: { select: { gymId: true } } },
  });

  if (!wod || wod.student.gymId !== gymId) {
    return { success: false, error: "WOD no encontrado." };
  }

  if (!(await teacherOwnsStudent(teacherId, wod.studentId, gymId))) {
    return { success: false, error: "No tenes permiso para editar este WOD." };
  }

  if (!content.trim()) {
    return { success: false, error: "El contenido del WOD no puede estar vacio." };
  }

  await prisma.wod.update({
    where: { id: wodId },
    data: { content },
  });

  revalidatePath(gymPath(gymSlug, `/dashboard/teacher/${wod.studentId}`));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true };
}

export async function copyWod(
  sourceWodId: string,
  targetStudentId: string,
  targetDate: string
): Promise<WodResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymId, gymSlug } = session.user;

  const sourceWod = await prisma.wod.findUnique({
    where: { id: sourceWodId },
    include: { student: { select: { gymId: true } } },
  });

  if (!sourceWod || sourceWod.student.gymId !== gymId) {
    return { success: false, error: "WOD origen no encontrado." };
  }

  if (!(await teacherOwnsStudent(teacherId, sourceWod.studentId, gymId))) {
    return { success: false, error: "No tenes permiso sobre el WOD origen." };
  }

  if (!(await teacherOwnsStudent(teacherId, targetStudentId, gymId))) {
    return { success: false, error: "El alumno destino no esta asignado a vos." };
  }

  const wodDate = new Date(targetDate + "T00:00:00.000Z");

  try {
    const newWod = await prisma.wod.create({
      data: {
        content: sourceWod.content,
        date: wodDate,
        studentId: targetStudentId,
        teacherId,
      },
    });

    revalidatePath(gymPath(gymSlug, `/dashboard/teacher/${targetStudentId}`));
    revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
    return { success: true, wodId: newWod.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Ya existe un WOD para ese alumno en esa fecha.",
      };
    }
    throw error;
  }
}

export async function deleteWod(wodId: string): Promise<WodResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymId, gymSlug } = session.user;

  const wod = await prisma.wod.findUnique({
    where: { id: wodId },
    include: { student: { select: { gymId: true } } },
  });

  if (!wod || wod.student.gymId !== gymId) {
    return { success: false, error: "WOD no encontrado." };
  }

  if (!(await teacherOwnsStudent(teacherId, wod.studentId, gymId))) {
    return { success: false, error: "No tenes permiso para eliminar este WOD." };
  }

  await prisma.wod.delete({ where: { id: wodId } });

  revalidatePath(gymPath(gymSlug, `/dashboard/teacher/${wod.studentId}`));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true };
}
