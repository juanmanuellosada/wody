"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";

export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "MERCADO_PAGO";

export type PaymentResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; requiresConfirmation: true; duplicateInfo: { studentName: string; paidAt: string } };

async function assertCanEditStudent(studentId: string) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { ok: false as const, error: "No autorizado." };
  }

  const student = await prisma.user.findFirst({ where: { id: studentId, deletedAt: null } });
  if (
    !student ||
    student.gymId !== session.user.gymId ||
    student.role !== "STUDENT"
  ) {
    return { ok: false as const, error: "Alumno no encontrado." };
  }

  if (session.user.role === "TEACHER") {
    const link = await prisma.teacherStudent.findUnique({
      where: {
        teacherId_studentId: { teacherId: session.user.id, studentId },
      },
    });
    if (!link) {
      return { ok: false as const, error: "Este alumno no está asignado a vos." };
    }
  }

  return { ok: true as const, session, student };
}

function revalidatePaymentViews(gymSlug: string) {
  revalidatePath(gymPath(gymSlug, "/pagos"));
  revalidatePath(gymPath(gymSlug, "/admin"));
  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
}

export async function setStudentPaymentDate(
  studentId: string,
  dateStr: string
): Promise<PaymentResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { success: false, error: "Fecha inválida." };
  }

  const check = await assertCanEditStudent(studentId);
  if (!check.ok) return { success: false, error: check.error };

  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { success: false, error: "Fecha inválida." };
  }

  await prisma.user.update({
    where: { id: studentId },
    data: { nextPaymentDate: parsed },
  });

  revalidatePaymentViews(check.session.user.gymSlug);
  return { success: true };
}

/** Registrar un pago: crea Payment + actualiza nextPaymentDate atómicamente.
 *
 * Si hay un pago existente del mismo alumno el mismo día calendario (según `paidAt`)
 * y `confirmedDuplicate` es false (o no se pasa), la acción devuelve
 * `{ success: false, requiresConfirmation: true, duplicateInfo }` en lugar de crear el pago.
 * El popup debe mostrar una confirmación y llamar de nuevo con `confirmedDuplicate: true`.
 */
export async function registerPayment(
  studentId: string,
  amount: number,
  nextPaymentDateStr: string,
  options?: {
    paidAtStr?: string;      // YYYY-MM-DD; defaults to today
    paymentMethod?: PaymentMethod;
    confirmedDuplicate?: boolean;
  }
): Promise<PaymentResult> {
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

  // paidAt: use provided date (start of day UTC) or now
  let paidAt: Date;
  if (options?.paidAtStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.paidAtStr)) {
      return { success: false, error: "Fecha del pago inválida." };
    }
    paidAt = new Date(`${options.paidAtStr}T00:00:00.000Z`);
    if (Number.isNaN(paidAt.getTime())) {
      return { success: false, error: "Fecha del pago inválida." };
    }
    // Reject future dates (compare calendar date in UTC)
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    if (paidAt.getTime() > todayUTC.getTime()) {
      return { success: false, error: "La fecha del pago no puede ser futura." };
    }
  } else {
    paidAt = new Date();
  }

  const check = await assertCanEditStudent(studentId);
  if (!check.ok) return { success: false, error: check.error };

  // Duplicate guard: look for any payment by this student on the same calendar day
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
        gymId: check.student.gymId,
        paidAt: { gte: dayStart, lte: dayEnd },
      },
    });
    if (existing) {
      const dateLabel = dayStart.toISOString().slice(0, 10);
      return {
        success: false,
        requiresConfirmation: true,
        duplicateInfo: {
          studentName: check.student.name,
          paidAt: dateLabel,
        },
      };
    }
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        gymId: check.student.gymId,
        studentId,
        amount,
        paidAt,
        paymentMethod: options?.paymentMethod ?? null,
        recordedById: check.session.user.id,
      },
    }),
    prisma.user.update({
      where: { id: studentId },
      data: { nextPaymentDate },
    }),
  ]);

  revalidatePaymentViews(check.session.user.gymSlug);
  return { success: true };
}

/** Editar el importe de un pago existente. Solo ADMIN. */
export async function updatePayment(
  paymentId: string,
  amount: number
): Promise<PaymentResult> {
  if (amount <= 0 || !Number.isFinite(amount)) {
    return { success: false, error: "El importe debe ser mayor a cero." };
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Solo administradores pueden editar pagos." };
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.gymId !== session.user.gymId) {
    return { success: false, error: "Pago no encontrado." };
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { amount },
  });

  revalidatePaymentViews(session.user.gymSlug);
  return { success: true };
}

/** Eliminar un pago. Solo ADMIN. No modifica nextPaymentDate. */
export async function deletePayment(paymentId: string): Promise<PaymentResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Solo administradores pueden eliminar pagos." };
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.gymId !== session.user.gymId) {
    return { success: false, error: "Pago no encontrado." };
  }

  await prisma.payment.delete({ where: { id: paymentId } });

  revalidatePaymentViews(session.user.gymSlug);
  return { success: true };
}
