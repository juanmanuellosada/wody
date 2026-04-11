"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { Prisma, WodTargetType } from "@prisma/client";

export type WodTarget =
  | { type: "ALL" }
  | { type: "GROUP"; groupId: string }
  | { type: "STUDENT"; studentId: string };

export type WodResult =
  | { success: true; wodId?: string }
  | { success: false; error: string };

async function validateTarget(
  target: WodTarget,
  teacherId: string
): Promise<string | null> {
  if (target.type === "GROUP") {
    const group = await prisma.group.findUnique({ where: { id: target.groupId } });
    if (!group || group.teacherId !== teacherId) {
      return "Grupo no encontrado.";
    }
  } else if (target.type === "STUDENT") {
    const link = await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId, studentId: target.studentId } },
    });
    if (!link) {
      return "Alumno no asignado a vos.";
    }
  }
  return null;
}

function targetToData(target: WodTarget) {
  return {
    targetType: target.type as WodTargetType,
    targetGroupId: target.type === "GROUP" ? target.groupId : null,
    targetStudentId: target.type === "STUDENT" ? target.studentId : null,
  };
}

export async function createWod(
  date: string,
  content: string,
  target: WodTarget = { type: "ALL" }
): Promise<WodResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;

  if (!content.trim()) {
    return { success: false, error: "El contenido del WOD no puede estar vacio." };
  }

  const targetError = await validateTarget(target, teacherId);
  if (targetError) return { success: false, error: targetError };

  const wodDate = new Date(date + "T00:00:00.000Z");

  const wod = await prisma.wod.create({
    data: {
      content,
      date: wodDate,
      teacherId,
      ...targetToData(target),
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true, wodId: wod.id };
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
  const { gymSlug } = session.user;

  const wod = await prisma.wod.findUnique({
    where: { id: wodId },
  });

  if (!wod || wod.teacherId !== teacherId) {
    return { success: false, error: "WOD no encontrado." };
  }

  if (!content.trim()) {
    return { success: false, error: "El contenido del WOD no puede estar vacio." };
  }

  await prisma.wod.update({
    where: { id: wodId },
    data: { content },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true };
}

export async function copyWod(
  sourceWodId: string,
  targetDate: string,
  target?: WodTarget
): Promise<WodResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;

  const sourceWod = await prisma.wod.findUnique({
    where: { id: sourceWodId },
    select: { content: true, teacherId: true, targetType: true, targetGroupId: true, targetStudentId: true },
  });

  if (!sourceWod || sourceWod.teacherId !== teacherId) {
    return { success: false, error: "WOD origen no encontrado." };
  }

  // Use provided target, or copy the source WOD's target
  const resolvedTarget: WodTarget = target ?? {
    type: sourceWod.targetType as WodTarget["type"],
    ...(sourceWod.targetType === "GROUP" && sourceWod.targetGroupId
      ? { groupId: sourceWod.targetGroupId }
      : {}),
    ...(sourceWod.targetType === "STUDENT" && sourceWod.targetStudentId
      ? { studentId: sourceWod.targetStudentId }
      : {}),
  } as WodTarget;

  const targetError = await validateTarget(resolvedTarget, teacherId);
  if (targetError) return { success: false, error: targetError };

  const wodDate = new Date(targetDate + "T00:00:00.000Z");

  const newWod = await prisma.wod.create({
    data: {
      content: sourceWod.content,
      date: wodDate,
      teacherId,
      ...targetToData(resolvedTarget),
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true, wodId: newWod.id };
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
  const { gymSlug } = session.user;

  const wod = await prisma.wod.findUnique({
    where: { id: wodId },
  });

  if (!wod || wod.teacherId !== teacherId) {
    return { success: false, error: "WOD no encontrado." };
  }

  await prisma.wod.delete({ where: { id: wodId } });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  return { success: true };
}
