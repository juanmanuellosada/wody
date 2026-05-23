"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function assertSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    throw new Error("forbidden");
  }
}

export type WhitelistRow = {
  id: number;
  email: string;
  note: string | null;
  createdAt: Date;
  consumedAt: Date | null;
};

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function listWhitelist(): Promise<WhitelistRow[]> {
  await assertSuperAdmin();
  return prisma.personalAccessWhitelist.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createEntry(email: string, note: string): Promise<ActionResult> {
  await assertSuperAdmin();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "El email no es válido." };
  }

  const existing = await prisma.personalAccessWhitelist.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Ya existe una entrada para este email." };
  }

  await prisma.personalAccessWhitelist.create({
    data: { email, note: note || null },
  });

  return { success: true };
}

export async function updateEntry(
  id: number,
  email: string,
  note: string
): Promise<ActionResult> {
  await assertSuperAdmin();

  const entry = await prisma.personalAccessWhitelist.findUnique({ where: { id } });
  if (!entry) {
    return { success: false, error: "Entrada no encontrada." };
  }

  if (entry.consumedAt !== null && email !== entry.email) {
    return {
      success: false,
      error: "No se puede cambiar el email de una entrada ya consumida. Solo podés editar la nota.",
    };
  }

  if (email !== entry.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "El email no es válido." };
    }
    const existing = await prisma.personalAccessWhitelist.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "Ya existe una entrada para este email." };
    }
  }

  await prisma.personalAccessWhitelist.update({
    where: { id },
    data: { email, note: note || null },
  });

  return { success: true };
}

export async function deleteEntry(id: number): Promise<ActionResult> {
  await assertSuperAdmin();

  const entry = await prisma.personalAccessWhitelist.findUnique({ where: { id } });
  if (!entry) {
    return { success: false, error: "Entrada no encontrada." };
  }

  if (entry.consumedAt !== null) {
    return {
      success: false,
      error: "No se puede borrar una entrada ya consumida. Queda como registro de auditoría.",
    };
  }

  await prisma.personalAccessWhitelist.delete({ where: { id } });
  return { success: true };
}
