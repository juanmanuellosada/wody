"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPublicImage, deleteBlobByUrl } from "@/lib/blob";
import { isReservedSlug } from "@/lib/reserved-slugs";
import bcrypt from "bcryptjs";
import type { GymKind } from "@prisma/client";

async function assertSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    throw new Error("forbidden");
  }
}

export type GymRow = {
  id: string;
  name: string;
  slug: string;
  kind: GymKind;
  logo: string | null;
  primaryColor: string | null;
  blockedAt: Date | null;
  autoBlockAfterDays: number;
  subscriptionNextPaymentDate: Date | null;
  subscriptionMonthlyAmount: number | null;
  createdAt: Date;
};

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function listAllGyms(): Promise<GymRow[]> {
  await assertSuperAdmin();
  return prisma.gym.findMany({
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      kind: true,
      logo: true,
      primaryColor: true,
      blockedAt: true,
      autoBlockAfterDays: true,
      subscriptionNextPaymentDate: true,
      subscriptionMonthlyAmount: true,
      createdAt: true,
    },
  });
}

export type CreateGymInput = {
  name: string;
  slug: string;
  // PERSONAL is excluded — gyms created from the panel must be GYM or BOX.
  kind: "GYM" | "BOX";
  primaryColor: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  subscriptionNextPaymentDate?: string;
  subscriptionMonthlyAmount?: number;
  autoBlockAfterDays?: number;
  logoFile?: File;
};

export async function createGym(input: CreateGymInput): Promise<ActionResult> {
  await assertSuperAdmin();

  const slug = input.slug.trim().toLowerCase();

  if (isReservedSlug(slug)) {
    return { success: false, error: `El slug "${slug}" está reservado. Elegí uno diferente.` };
  }

  const existingGym = await prisma.gym.findUnique({ where: { slug } });
  if (existingGym) {
    return { success: false, error: "El slug ya existe. Elegí uno diferente." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.adminEmail)) {
    return { success: false, error: "El email del admin no es válido." };
  }

  if (input.adminPassword.length < 8) {
    return { success: false, error: "La contraseña del admin debe tener al menos 8 caracteres." };
  }

  if (!input.adminName.trim()) {
    return { success: false, error: "El nombre del admin no puede estar vacío." };
  }

  if (!input.name.trim()) {
    return { success: false, error: "El nombre del gym no puede estar vacío." };
  }

  let logo: string | null = null;
  if (input.logoFile) {
    try {
      const result = await uploadPublicImage(input.logoFile, "gyms");
      logo = result.url;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Error al subir el logo." };
    }
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          name: input.name.trim(),
          slug,
          kind: input.kind as GymKind,
          primaryColor: input.primaryColor,
          logo,
          autoBlockAfterDays: input.autoBlockAfterDays ?? 45,
          subscriptionNextPaymentDate: input.subscriptionNextPaymentDate
            ? new Date(input.subscriptionNextPaymentDate)
            : null,
          subscriptionMonthlyAmount: input.subscriptionMonthlyAmount ?? null,
        },
      });

      await tx.user.create({
        data: {
          name: input.adminName.trim(),
          email: input.adminEmail.trim().toLowerCase(),
          password: passwordHash,
          role: "ADMIN",
          gymId: gym.id,
          memberNumber: 1,
        },
      });
    });
  } catch (err) {
    // If a Blob was already uploaded, we can't easily roll it back.
    // Accept the orphaned file — the owner can clean it from Blob dashboard.
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear el gym. La transacción fue revertida.",
    };
  }

  return { success: true };
}

export type UpdateGymInput = {
  id: string;
  name?: string;
  kind?: "GYM" | "BOX";
  primaryColor?: string;
  autoBlockAfterDays?: number;
  subscriptionNextPaymentDate?: string | null;
  subscriptionMonthlyAmount?: number | null;
  logoFile?: File;
};

export async function updateGym(input: UpdateGymInput): Promise<ActionResult> {
  await assertSuperAdmin();

  const gym = await prisma.gym.findUnique({ where: { id: input.id } });
  if (!gym) {
    return { success: false, error: "Gym no encontrado." };
  }

  let logo = gym.logo;
  if (input.logoFile) {
    try {
      const result = await uploadPublicImage(input.logoFile, "gyms");
      if (gym.logo) {
        await deleteBlobByUrl(gym.logo);
      }
      logo = result.url;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Error al subir el logo." };
    }
  }

  await prisma.gym.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.kind !== undefined && { kind: input.kind as GymKind }),
      ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
      ...(input.autoBlockAfterDays !== undefined && { autoBlockAfterDays: input.autoBlockAfterDays }),
      ...(input.subscriptionNextPaymentDate !== undefined && {
        subscriptionNextPaymentDate: input.subscriptionNextPaymentDate
          ? new Date(input.subscriptionNextPaymentDate)
          : null,
      }),
      ...(input.subscriptionMonthlyAmount !== undefined && {
        subscriptionMonthlyAmount: input.subscriptionMonthlyAmount,
      }),
      logo,
    },
  });

  return { success: true };
}

export async function blockGym(gymId: string): Promise<ActionResult> {
  await assertSuperAdmin();
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return { success: false, error: "Gym no encontrado." };

  await prisma.gym.update({ where: { id: gymId }, data: { blockedAt: new Date() } });
  return { success: true };
}

export async function unblockGym(gymId: string): Promise<ActionResult> {
  await assertSuperAdmin();
  const gym = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!gym) return { success: false, error: "Gym no encontrado." };

  await prisma.gym.update({ where: { id: gymId }, data: { blockedAt: null } });
  return { success: true };
}

export async function uploadGymLogo(file: File): Promise<{ success: true; url: string } | { success: false; error: string }> {
  await assertSuperAdmin();
  try {
    const result = await uploadPublicImage(file, "gyms");
    return { success: true, url: result.url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error al subir el logo." };
  }
}
