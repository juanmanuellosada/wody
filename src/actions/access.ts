"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { generateQrToken } from "@/lib/qr";

export type AccessResult =
  | { success: true }
  | { success: false; error: string };

// Regenera el qrToken de un usuario. Permitido al ADMIN del mismo gym o al
// propio usuario sobre sí mismo. El QR anterior deja de funcionar en el
// momento en que se pisa la columna.
export async function regenerateQrToken(
  userId: string
): Promise<AccessResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const isSelf = session.user.id === userId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isSelf && !isAdmin) {
    return { success: false, error: "No autorizado." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { gymId: true },
  });
  if (!target || target.gymId !== session.user.gymId) {
    return { success: false, error: "Usuario no encontrado." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { qrToken: generateQrToken() },
  });

  const gymSlug = session.user.gymSlug;
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  revalidatePath(gymPath(gymSlug, "/admin"));
  return { success: true };
}
