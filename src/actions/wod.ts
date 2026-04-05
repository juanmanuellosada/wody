"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { Prisma } from "@prisma/client";

export type WodResult =
  | { success: true; wodId?: string }
  | { success: false; error: string };

export async function createWod(
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
  const { gymSlug } = session.user;

  if (!content.trim()) {
    return { success: false, error: "El contenido del WOD no puede estar vacio." };
  }

  const wodDate = new Date(date + "T00:00:00.000Z");

  try {
    const wod = await prisma.wod.create({
      data: {
        content,
        date: wodDate,
        teacherId,
      },
    });

    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
    return { success: true, wodId: wod.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Ya existe un WOD para esa fecha.",
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
  const { gymSlug } = session.user;

  const sourceWod = await prisma.wod.findUnique({
    where: { id: sourceWodId },
  });

  if (!sourceWod || sourceWod.teacherId !== teacherId) {
    return { success: false, error: "WOD origen no encontrado." };
  }

  const wodDate = new Date(targetDate + "T00:00:00.000Z");

  try {
    const newWod = await prisma.wod.create({
      data: {
        content: sourceWod.content,
        date: wodDate,
        teacherId,
      },
    });

    revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
    revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
    return { success: true, wodId: newWod.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "Ya existe un WOD para esa fecha.",
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
