"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { getTodayArgentina, toInputDate } from "@/lib/dates";

export type FixedRoutineResult =
  | { success: true; id?: string }
  | { success: false; error: string };

// Returns the active fixed routine for a student (most recent, deletedAt = null)
export async function getActiveFixedRoutine(studentId: string) {
  return prisma.fixedRoutine.findFirst({
    where: { studentId, deletedAt: null },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      assignedAt: true,
      renewAt: true,
      teacher: { select: { name: true } },
    },
  });
}

// Returns all active routines in a gym that are due for renewal (within 7 days or overdue).
// Used by ADMIN on the teacher dashboard to see all pending renewals.
export async function getGymRenewalRoutines(gymId: string) {
  const today = getTodayArgentina();
  const sevenDaysOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const routines = await prisma.fixedRoutine.findMany({
    where: {
      gymId,
      deletedAt: null,
      renewAt: { lte: sevenDaysOut },
    },
    orderBy: { renewAt: "asc" },
    select: {
      id: true,
      renewAt: true,
      student: { select: { id: true, name: true } },
    },
  });

  const byStudent = new Map<string, typeof routines[number]>();
  for (const r of routines) {
    const existing = byStudent.get(r.student.id);
    if (!existing || r.renewAt > existing.renewAt) {
      byStudent.set(r.student.id, r);
    }
  }

  const todayStr = toInputDate(today);
  return Array.from(byStudent.values()).map((r) => ({
    id: r.id,
    studentId: r.student.id,
    studentName: r.student.name,
    renewAt: r.renewAt,
    overdue: toInputDate(r.renewAt) < todayStr,
  }));
}

// Returns the teacher's active routines that are due for renewal (within 7 days or overdue)
export async function getTeacherRenewalRoutines(teacherId: string) {
  const today = getTodayArgentina();
  const sevenDaysOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fetch all active routines of this teacher where renewAt <= today + 7 days
  const routines = await prisma.fixedRoutine.findMany({
    where: {
      teacherId,
      deletedAt: null,
      renewAt: { lte: sevenDaysOut },
    },
    orderBy: { renewAt: "asc" },
    select: {
      id: true,
      renewAt: true,
      student: { select: { id: true, name: true } },
    },
  });

  // Filter: only keep the most recent active routine per student
  // (in case of data inconsistency; normally there's one active per student)
  const byStudent = new Map<string, typeof routines[number]>();
  for (const r of routines) {
    const existing = byStudent.get(r.student.id);
    if (!existing || r.renewAt > existing.renewAt) {
      byStudent.set(r.student.id, r);
    }
  }

  const todayStr = toInputDate(today);
  return Array.from(byStudent.values()).map((r) => ({
    id: r.id,
    studentId: r.student.id,
    studentName: r.student.name,
    renewAt: r.renewAt,
    overdue: toInputDate(r.renewAt) < todayStr,
  }));
}

export async function createFixedRoutine(
  studentId: string,
  title: string,
  content: string,
  renewAtStr?: string
): Promise<FixedRoutineResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;
  const teacherId = session.user.id;

  // GYM-only guard
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { kind: true } });
  if (!gym || gym.kind !== "GYM") {
    return { success: false, error: "Las rutinas fijas solo están disponibles en gimnasios tradicionales." };
  }

  // Validate student belongs to this gym and is not LITE
  const student = await prisma.user.findFirst({
    where: { id: studentId, gymId, deletedAt: null, role: "STUDENT" },
    select: { accountKind: true, studentType: true },
  });
  if (!student) {
    return { success: false, error: "Alumno no encontrado." };
  }
  if (student.accountKind === "LITE") {
    return { success: false, error: "No se puede asignar rutina fija a un alumno lite." };
  }

  // Validate TeacherStudent link (ADMIN can bypass this check)
  if (session.user.role === "TEACHER") {
    const link = await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId, studentId } },
    });
    if (!link) {
      return { success: false, error: "Alumno no asignado a vos." };
    }
  }

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (!trimmedTitle) return { success: false, error: "El título es obligatorio." };
  if (!trimmedContent) return { success: false, error: "El contenido es obligatorio." };

  const assignedAt = new Date();
  let renewAt: Date;
  if (renewAtStr && renewAtStr.trim()) {
    renewAt = new Date(`${renewAtStr.trim()}T00:00:00.000Z`);
    if (isNaN(renewAt.getTime())) {
      return { success: false, error: "Fecha de renovación inválida." };
    }
  } else {
    // Default: +30 days from today
    renewAt = new Date(assignedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    renewAt = new Date(Date.UTC(renewAt.getUTCFullYear(), renewAt.getUTCMonth(), renewAt.getUTCDate()));
  }

  const routine = await prisma.fixedRoutine.create({
    data: {
      gymId,
      studentId,
      teacherId,
      title: trimmedTitle,
      content: trimmedContent,
      assignedAt,
      renewAt,
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));

  return { success: true, id: routine.id };
}

export async function updateFixedRoutine(
  routineId: string,
  title: string,
  content: string,
  renewAtStr: string
): Promise<FixedRoutineResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;
  const teacherId = session.user.id;

  // GYM-only guard
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { kind: true } });
  if (!gym || gym.kind !== "GYM") {
    return { success: false, error: "Las rutinas fijas solo están disponibles en gimnasios tradicionales." };
  }

  const routine = await prisma.fixedRoutine.findFirst({
    where: { id: routineId, gymId, deletedAt: null },
  });
  if (!routine) {
    return { success: false, error: "Rutina no encontrada." };
  }

  // Teachers can only edit their own routines
  if (session.user.role === "TEACHER" && routine.teacherId !== teacherId) {
    return { success: false, error: "No autorizado." };
  }

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (!trimmedTitle) return { success: false, error: "El título es obligatorio." };
  if (!trimmedContent) return { success: false, error: "El contenido es obligatorio." };

  let renewAt: Date | undefined;
  if (renewAtStr && renewAtStr.trim()) {
    renewAt = new Date(`${renewAtStr.trim()}T00:00:00.000Z`);
    if (isNaN(renewAt.getTime())) {
      return { success: false, error: "Fecha de renovación inválida." };
    }
  }

  await prisma.fixedRoutine.update({
    where: { id: routineId },
    data: {
      title: trimmedTitle,
      content: trimmedContent,
      ...(renewAt ? { renewAt } : {}),
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));

  return { success: true };
}

// Updates only the renewAt date of an existing active fixed routine.
export async function updateFixedRoutineRenewAt(
  routineId: string,
  renewAt: Date
): Promise<FixedRoutineResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;
  const teacherId = session.user.id;

  // GYM-only guard
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { kind: true } });
  if (!gym || gym.kind !== "GYM") {
    return { success: false, error: "Las rutinas fijas solo están disponibles en gimnasios tradicionales." };
  }

  const routine = await prisma.fixedRoutine.findFirst({
    where: { id: routineId, gymId, deletedAt: null },
  });
  if (!routine) {
    return { success: false, error: "Rutina no encontrada." };
  }

  if (session.user.role === "TEACHER" && routine.teacherId !== teacherId) {
    return { success: false, error: "No autorizado." };
  }

  if (isNaN(renewAt.getTime())) {
    return { success: false, error: "Fecha de renovación inválida." };
  }

  await prisma.fixedRoutine.update({
    where: { id: routineId },
    data: { renewAt },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  revalidatePath(gymPath(gymSlug, "/admin"));

  return { success: true };
}

export async function deleteFixedRoutine(routineId: string): Promise<FixedRoutineResult> {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    return { success: false, error: "No autorizado." };
  }

  if (!session.user.gymId || !session.user.gymSlug) {
    return { success: false, error: "No autorizado." };
  }

  const gymId = session.user.gymId;
  const gymSlug = session.user.gymSlug;
  const teacherId = session.user.id;

  const routine = await prisma.fixedRoutine.findFirst({
    where: { id: routineId, gymId, deletedAt: null },
  });
  if (!routine) {
    return { success: false, error: "Rutina no encontrada." };
  }

  if (session.user.role === "TEACHER" && routine.teacherId !== teacherId) {
    return { success: false, error: "No autorizado." };
  }

  await prisma.fixedRoutine.update({
    where: { id: routineId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));

  return { success: true };
}
