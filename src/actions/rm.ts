"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";

export type RmResult =
  | { success: true }
  | { success: false; error: string };

type RmValidation =
  | { ok: true; exercise: string; weight: number; date: Date }
  | { ok: false; error: string };

function validateRmFields(formData: FormData): RmValidation {
  const exercise = (formData.get("exercise") as string | null)?.trim();
  const weightRaw = formData.get("weight") as string | null;
  const dateRaw = formData.get("date") as string | null;

  if (!exercise) {
    return { ok: false, error: "El ejercicio no puede estar vacio." };
  }

  const weight = parseFloat(weightRaw ?? "");
  if (isNaN(weight) || weight <= 0) {
    return { ok: false, error: "El peso debe ser mayor a 0." };
  }

  if (!dateRaw) {
    return { ok: false, error: "La fecha es obligatoria." };
  }

  const date = new Date(dateRaw + "T00:00:00.000Z");

  return { ok: true, exercise, weight, date };
}

export async function createRm(formData: FormData): Promise<RmResult> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const { gymSlug } = session.user;

  const parsed = validateRmFields(formData);
  if (!parsed.ok) {
    return { success: false, error: parsed.error };
  }

  await prisma.rM.create({
    data: {
      exercise: parsed.exercise,
      weight: parsed.weight,
      date: parsed.date,
      studentId: session.user.id,
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/rms"));
  return { success: true };
}

export async function updateRm(rmId: string, formData: FormData): Promise<RmResult> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const { gymSlug } = session.user;

  const [rm, gym] = await Promise.all([
    prisma.rM.findUnique({ where: { id: rmId } }),
    prisma.gym.findUnique({ where: { slug: gymSlug }, select: { kind: true } }),
  ]);

  if (!rm || rm.studentId !== session.user.id) {
    return { success: false, error: gymTerms(gym?.kind ?? "BOX").rmNotFound };
  }

  const parsed = validateRmFields(formData);
  if (!parsed.ok) {
    return { success: false, error: parsed.error };
  }

  await prisma.rM.update({
    where: { id: rmId },
    data: {
      exercise: parsed.exercise,
      weight: parsed.weight,
      date: parsed.date,
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/rms"));
  return { success: true };
}

export async function deleteRm(rmId: string): Promise<RmResult> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const { gymSlug } = session.user;

  const [rm, gym] = await Promise.all([
    prisma.rM.findUnique({ where: { id: rmId } }),
    prisma.gym.findUnique({ where: { slug: gymSlug }, select: { kind: true } }),
  ]);

  if (!rm || rm.studentId !== session.user.id) {
    return { success: false, error: gymTerms(gym?.kind ?? "BOX").rmNotFound };
  }

  await prisma.rM.delete({ where: { id: rmId } });

  revalidatePath(gymPath(gymSlug, "/dashboard/rms"));
  return { success: true };
}
