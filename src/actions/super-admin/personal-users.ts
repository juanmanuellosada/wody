"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";

export type PersonalUserRow = {
  id: string;
  name: string;
  email: string | null;
  accountKind: "FULL" | "LITE";
  nextPaymentDate: Date;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  blockedAt: Date | null;
  /** Last paid amount, or null if no payments on record */
  lastAmount: number | null;
};

export type PersonalPaymentResult =
  | { success: true }
  | { success: false; error: string }
  | {
      success: false;
      requiresConfirmation: true;
      duplicateInfo: { studentName: string; paidAt: string };
    };

async function assertSuperAdmin() {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    throw new Error("forbidden");
  }
  return session;
}

/** Fetch the personal gym id (slug = 'personal', kind = PERSONAL). */
async function getPersonalGymId(): Promise<string> {
  const gym = await prisma.gym.findUnique({
    where: { slug: "personal" },
    select: { id: true },
  });
  if (!gym) throw new Error("Gym personal no encontrado.");
  return gym.id;
}

export async function listPersonalUsers(): Promise<PersonalUserRow[]> {
  await assertSuperAdmin();
  const gymId = await getPersonalGymId();

  const users = await prisma.user.findMany({
    where: { gymId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      accountKind: true,
      nextPaymentDate: true,
      paymentExempt: true,
      paymentExemptReason: true,
      blockedAt: true,
      paymentsAsPayer: {
        select: { amount: true },
        orderBy: { paidAt: "desc" },
        take: 1,
      },
    },
  });

  // Sort: exentos al final, resto por nextPaymentDate asc (vencidos primero).
  const rows: PersonalUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    accountKind: u.accountKind,
    nextPaymentDate: u.nextPaymentDate,
    paymentExempt: u.paymentExempt,
    paymentExemptReason: u.paymentExemptReason,
    blockedAt: u.blockedAt,
    lastAmount:
      u.paymentsAsPayer[0]?.amount != null
        ? Number(u.paymentsAsPayer[0].amount)
        : null,
  }));

  rows.sort((a, b) => {
    const aExempt = a.paymentExempt;
    const bExempt = b.paymentExempt;
    if (aExempt && !bExempt) return 1;
    if (!aExempt && bExempt) return -1;
    const da = a.nextPaymentDate.getTime();
    const db = b.nextPaymentDate.getTime();
    return da - db;
  });

  return rows;
}

export async function registerPersonalPayment(
  studentId: string,
  amount: number,
  nextPaymentDateStr: string,
  options?: {
    paidAtStr?: string;
    paymentMethod?: PaymentMethod;
    confirmedDuplicate?: boolean;
  }
): Promise<PersonalPaymentResult> {
  const session = await assertSuperAdmin();
  const gymId = await getPersonalGymId();

  if (amount <= 0 || !Number.isFinite(amount)) {
    return { success: false, error: "El importe debe ser mayor a cero." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextPaymentDateStr)) {
    return { success: false, error: "Fecha de próximo pago inválida." };
  }

  const nextPaymentDate = new Date(`${nextPaymentDateStr}T00:00:00.000Z`);
  if (Number.isNaN(nextPaymentDate.getTime())) {
    return { success: false, error: "Fecha de próximo pago inválida." };
  }

  let paidAt: Date;
  if (options?.paidAtStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.paidAtStr)) {
      return { success: false, error: "Fecha del pago inválida." };
    }
    paidAt = new Date(`${options.paidAtStr}T00:00:00.000Z`);
    if (Number.isNaN(paidAt.getTime())) {
      return { success: false, error: "Fecha del pago inválida." };
    }
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    if (paidAt.getTime() > todayUTC.getTime()) {
      return { success: false, error: "La fecha del pago no puede ser futura." };
    }
  } else {
    paidAt = new Date();
  }

  // Verify student belongs to personal gym
  const student = await prisma.user.findFirst({
    where: { id: studentId, gymId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!student) {
    return { success: false, error: "Usuario no encontrado." };
  }

  // Duplicate guard
  if (!options?.confirmedDuplicate) {
    const dayStart = new Date(
      Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate())
    );
    const dayEnd = new Date(
      Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate(), 23, 59, 59, 999)
    );
    const existing = await prisma.payment.findFirst({
      where: {
        studentId,
        gymId,
        paidAt: { gte: dayStart, lte: dayEnd },
      },
    });
    if (existing) {
      const dateLabel = dayStart.toISOString().slice(0, 10);
      return {
        success: false,
        requiresConfirmation: true,
        duplicateInfo: { studentName: student.name, paidAt: dateLabel },
      };
    }
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        gymId,
        studentId,
        amount,
        paidAt,
        paymentMethod: options?.paymentMethod ?? null,
        recordedById: session.user.id,
      },
    }),
    prisma.user.update({
      where: { id: studentId },
      data: { nextPaymentDate },
    }),
  ]);

  revalidatePath("/admin/wody-personal");
  return { success: true };
}
