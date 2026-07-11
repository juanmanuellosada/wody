"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";

export type ExpenseResult =
  | { success: true }
  | { success: false; error: string };

/** Registrar/editar/eliminar gastos: ADMIN + canViewRevenue fresco de DB. */
async function assertCanManageExpenses() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false as const, error: "No autorizado." };
  }
  if (!session.user.gymId || !session.user.gymSlug) {
    return { ok: false as const, error: "No autorizado." };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canViewRevenue: true },
  });
  if (!dbUser?.canViewRevenue) {
    return { ok: false as const, error: "No autorizado." };
  }

  return { ok: true as const, session, gymId: session.user.gymId, gymSlug: session.user.gymSlug };
}

function revalidateExpenseViews(gymSlug: string) {
  revalidatePath(gymPath(gymSlug, "/caja"));
}

export async function registerExpense(
  amount: number,
  description: string,
  options?: { spentAtStr?: string } // YYYY-MM-DD; default hoy
): Promise<ExpenseResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "El importe debe ser mayor a cero." };
  }
  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    return { success: false, error: "La descripción es obligatoria." };
  }

  let spentAt: Date;
  if (options?.spentAtStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.spentAtStr)) {
      return { success: false, error: "Fecha del gasto inválida." };
    }
    spentAt = new Date(`${options.spentAtStr}T00:00:00.000Z`);
    if (Number.isNaN(spentAt.getTime())) {
      return { success: false, error: "Fecha del gasto inválida." };
    }
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    if (spentAt.getTime() > todayUTC.getTime()) {
      return { success: false, error: "La fecha del gasto no puede ser futura." };
    }
  } else {
    spentAt = new Date();
  }

  const check = await assertCanManageExpenses();
  if (!check.ok) return { success: false, error: check.error };

  await prisma.expense.create({
    data: {
      gymId: check.gymId,
      amount,
      description: trimmedDescription,
      spentAt,
      recordedById: check.session.user.id,
    },
  });

  revalidateExpenseViews(check.gymSlug);
  return { success: true };
}

export async function updateExpense(
  expenseId: string,
  data: { amount?: number; description?: string }
): Promise<ExpenseResult> {
  const check = await assertCanManageExpenses();
  if (!check.ok) return { success: false, error: check.error };

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.gymId !== check.gymId) {
    return { success: false, error: "Gasto no encontrado." };
  }

  const updateData: { amount?: number; description?: string } = {};

  if (data.amount !== undefined) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      return { success: false, error: "El importe debe ser mayor a cero." };
    }
    updateData.amount = data.amount;
  }
  if (data.description !== undefined) {
    const trimmed = data.description.trim();
    if (!trimmed) return { success: false, error: "La descripción no puede estar vacía." };
    updateData.description = trimmed;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "No hay cambios para guardar." };
  }

  await prisma.expense.update({ where: { id: expenseId }, data: updateData });

  revalidateExpenseViews(check.gymSlug);
  return { success: true };
}

export async function deleteExpense(expenseId: string): Promise<ExpenseResult> {
  const check = await assertCanManageExpenses();
  if (!check.ok) return { success: false, error: check.error };

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.gymId !== check.gymId) {
    return { success: false, error: "Gasto no encontrado." };
  }

  await prisma.expense.delete({ where: { id: expenseId } });

  revalidateExpenseViews(check.gymSlug);
  return { success: true };
}
