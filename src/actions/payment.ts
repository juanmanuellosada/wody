"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { addOneMonth } from "@/lib/dates";

export type PaymentResult =
  | { success: true }
  | { success: false; error: string };

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

export async function markStudentAsPaid(
  studentId: string
): Promise<PaymentResult> {
  const check = await assertCanEditStudent(studentId);
  if (!check.ok) return { success: false, error: check.error };

  const nextDate = addOneMonth(check.student.nextPaymentDate);

  await prisma.user.update({
    where: { id: studentId },
    data: { nextPaymentDate: nextDate },
  });

  revalidatePaymentViews(check.session.user.gymSlug);
  return { success: true };
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
