"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type WhitelistResult = { ok: true } | { ok: false; error: string };

async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    throw new Error("No autorizado. Se requiere isPlatformAdmin.");
  }
  return session;
}

export async function addToWhitelist({
  email,
  note,
}: {
  email: string;
  note?: string;
}): Promise<WhitelistResult> {
  const session = await requirePlatformAdmin();

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "Email inválido" };
  }

  const existing = await prisma.personalAccessWhitelist.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return { ok: false, error: "duplicate" };
  }

  await prisma.personalAccessWhitelist.create({
    data: {
      email: normalizedEmail,
      note: note?.trim() || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/personal-whitelist");
  return { ok: true };
}

export async function removeFromWhitelist({
  email,
}: {
  email: string;
}): Promise<WhitelistResult> {
  await requirePlatformAdmin();

  const normalizedEmail = email.trim().toLowerCase();

  try {
    await prisma.personalAccessWhitelist.delete({
      where: { email: normalizedEmail },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, error: "not_found" };
    }
    throw e;
  }

  revalidatePath("/admin/personal-whitelist");
  return { ok: true };
}

export async function listWhitelist({
  search,
}: {
  search?: string;
} = {}) {
  await requirePlatformAdmin();

  const entries = await prisma.personalAccessWhitelist.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    where: search
      ? { email: { contains: search.toLowerCase() } }
      : undefined,
  });

  return entries;
}
