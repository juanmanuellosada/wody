"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import type { PaymentMethod } from "@/actions/payment";

export type SaleResult =
  | { success: true }
  | { success: false; error: string };

/** Registrar venta: ADMIN + TEACHER con acceso a Caja (sin canViewRevenue). */
async function assertCanSell() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { ok: false as const, error: "No autorizado." };
  }
  if (!session.user.gymId || !session.user.gymSlug) {
    return { ok: false as const, error: "No autorizado." };
  }
  return { ok: true as const, session, gymId: session.user.gymId, gymSlug: session.user.gymSlug };
}

function revalidateSaleViews(gymSlug: string) {
  revalidatePath(gymPath(gymSlug, "/caja"));
  revalidatePath(gymPath(gymSlug, "/productos"));
}

/**
 * Registrar una venta: crea Sale + descuenta stock del producto atómicamente.
 * No bloquea por falta de stock (puede quedar en 0 o negativo); el aviso es
 * responsabilidad de la UI, que ya conoce el stock del producto seleccionado.
 */
export async function registerSale(
  productId: string,
  quantity: number,
  unitAmount: number,
  options: {
    soldAtStr?: string; // YYYY-MM-DD; default hoy
    paymentMethod: PaymentMethod;
  }
): Promise<SaleResult> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { success: false, error: "La cantidad debe ser un entero mayor o igual a 1." };
  }
  if (!Number.isFinite(unitAmount) || unitAmount < 0) {
    return { success: false, error: "El importe unitario debe ser mayor o igual a cero." };
  }
  if (!options.paymentMethod) {
    return { success: false, error: "Seleccioná el método de pago." };
  }

  let soldAt: Date;
  if (options.soldAtStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.soldAtStr)) {
      return { success: false, error: "Fecha de la venta inválida." };
    }
    soldAt = new Date(`${options.soldAtStr}T00:00:00.000Z`);
    if (Number.isNaN(soldAt.getTime())) {
      return { success: false, error: "Fecha de la venta inválida." };
    }
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    if (soldAt.getTime() > todayUTC.getTime()) {
      return { success: false, error: "La fecha de la venta no puede ser futura." };
    }
  } else {
    soldAt = new Date();
  }

  const check = await assertCanSell();
  if (!check.ok) return { success: false, error: check.error };

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product || product.gymId !== check.gymId) {
    return { success: false, error: "Producto no encontrado." };
  }

  const totalAmount = quantity * unitAmount;

  await prisma.$transaction([
    prisma.sale.create({
      data: {
        gymId: check.gymId,
        productId,
        quantity,
        unitAmount,
        totalAmount,
        paymentMethod: options.paymentMethod,
        soldAt,
        recordedById: check.session.user.id,
      },
    }),
    prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    }),
  ]);

  revalidateSaleViews(check.gymSlug);
  return { success: true };
}

/** Editar una venta (importe/cantidad). Solo ADMIN. No reajusta el stock del producto. */
export async function updateSale(
  saleId: string,
  data: { quantity?: number; unitAmount?: number }
): Promise<SaleResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Solo administradores pueden editar ventas." };
  }
  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.gymId !== session.user.gymId) {
    return { success: false, error: "Venta no encontrada." };
  }

  const quantity = data.quantity ?? sale.quantity;
  const unitAmount = data.unitAmount ?? Number(sale.unitAmount);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return { success: false, error: "La cantidad debe ser un entero mayor o igual a 1." };
  }
  if (!Number.isFinite(unitAmount) || unitAmount < 0) {
    return { success: false, error: "El importe unitario debe ser mayor o igual a cero." };
  }

  await prisma.sale.update({
    where: { id: saleId },
    data: { quantity, unitAmount, totalAmount: quantity * unitAmount },
  });

  revalidateSaleViews(session.user.gymSlug);
  return { success: true };
}

/** Eliminar una venta. Solo ADMIN. No repone el stock descontado. */
export async function deleteSale(saleId: string): Promise<SaleResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Solo administradores pueden eliminar ventas." };
  }
  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.gymId !== session.user.gymId) {
    return { success: false, error: "Venta no encontrada." };
  }

  await prisma.sale.delete({ where: { id: saleId } });

  revalidateSaleViews(session.user.gymSlug);
  return { success: true };
}
