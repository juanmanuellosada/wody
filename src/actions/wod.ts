"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import { WodTargetType } from "@prisma/client";

async function termsForSlug(slug: string) {
  const gym = await prisma.gym.findUnique({ where: { slug }, select: { kind: true } });
  return gymTerms(gym?.kind ?? "BOX");
}

export type WodTarget =
  | { type: "ALL" }
  | { type: "PERSONALIZED" }
  | { type: "GROUP"; groupId: string }
  | { type: "STUDENT"; studentId: string };

export type WodResult =
  | { success: true; wodId?: string }
  | { success: false; error: string };

type SessionUser = {
  id: string;
  role: string;
  canCreateOwnRoutines: boolean;
};

function isSelfTarget(target: WodTarget, userId: string) {
  return target.type === "STUDENT" && target.studentId === userId;
}

// Authorizes a create/update where the acting user is also the WOD's "teacher"
// field. Teachers/admins can use any target; other roles can only target
// themselves and only if they have canCreateOwnRoutines.
function canWriteWithTarget(user: SessionUser, target: WodTarget) {
  if (user.role === "TEACHER" || user.role === "ADMIN") return true;
  return user.canCreateOwnRoutines && isSelfTarget(target, user.id);
}

// Authorizes operations that don't take a new target (delete, some updates).
// Teachers/admins can always act on wods they own. Self-service users can act
// on their own self-targeted wods.
function canWriteExisting(
  user: SessionUser,
  wod: { targetType: string; targetStudentId: string | null }
) {
  if (user.role === "TEACHER" || user.role === "ADMIN") return true;
  return (
    user.canCreateOwnRoutines &&
    wod.targetType === "STUDENT" &&
    wod.targetStudentId === user.id
  );
}

async function validateTarget(
  target: WodTarget,
  teacherId: string
): Promise<string | null> {
  if (target.type === "GROUP") {
    const group = await prisma.group.findFirst({ where: { id: target.groupId, deletedAt: null } });
    if (!group || group.teacherId !== teacherId) {
      return "Grupo no encontrado.";
    }
  } else if (target.type === "STUDENT") {
    // Self-target (teacher creating their own routine, or self-service
    // student) doesn't require a TeacherStudent link.
    if (target.studentId === teacherId) return null;
    const link = await prisma.teacherStudent.findUnique({
      where: { teacherId_studentId: { teacherId, studentId: target.studentId } },
    });
    if (!link) {
      return "Alumno no asignado a vos.";
    }
  }
  return null;
}

function targetToData(target: WodTarget) {
  return {
    targetType: target.type as WodTargetType,
    targetGroupId: target.type === "GROUP" ? target.groupId : null,
    targetStudentId: target.type === "STUDENT" ? target.studentId : null,
  };
}

export async function createWod(
  date: string,
  title: string,
  content: string,
  target: WodTarget = { type: "ALL" }
): Promise<WodResult> {
  const session = await auth();

  if (!session?.user || !canWriteWithTarget(session.user, target)) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;
  const terms = await termsForSlug(gymSlug);

  const trimmedTitle = title.trim() || terms.wod;

  if (!content.trim()) {
    return { success: false, error: terms.wodContentEmptyError };
  }

  const targetError = await validateTarget(target, teacherId);
  if (targetError) return { success: false, error: targetError };

  const wodDate = new Date(date + "T00:00:00.000Z");

  const wod = await prisma.wod.create({
    data: {
      title: trimmedTitle,
      content,
      date: wodDate,
      teacherId,
      ...targetToData(target),
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  revalidatePath(gymPath(gymSlug, "/dashboard/mis-rutinas"));
  return { success: true, wodId: wod.id };
}

export async function updateWod(
  wodId: string,
  title: string,
  content: string,
  date?: string,
  target?: WodTarget
): Promise<WodResult> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;
  const terms = await termsForSlug(gymSlug);

  const wod = await prisma.wod.findFirst({
    where: { id: wodId, deletedAt: null },
  });

  if (!wod || wod.teacherId !== teacherId) {
    return { success: false, error: terms.wodNotFound };
  }

  if (!canWriteExisting(session.user, wod)) {
    return { success: false, error: "No autorizado." };
  }

  // Self-service students can't reassign target; force-keep existing target
  // when the new one isn't still self.
  if (target && !canWriteWithTarget(session.user, target)) {
    return { success: false, error: "No autorizado." };
  }

  const trimmedTitle = title.trim() || terms.wod;

  if (!content.trim()) {
    return { success: false, error: terms.wodContentEmptyError };
  }

  if (target) {
    const targetError = await validateTarget(target, teacherId);
    if (targetError) return { success: false, error: targetError };
  }

  await prisma.wod.update({
    where: { id: wodId },
    data: {
      title: trimmedTitle,
      content,
      ...(date ? { date: new Date(date + "T00:00:00.000Z") } : {}),
      ...(target ? targetToData(target) : {}),
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  revalidatePath(gymPath(gymSlug, "/dashboard/mis-rutinas"));
  return { success: true };
}

export async function copyWod(
  sourceWodId: string,
  targetDate: string,
  target?: WodTarget
): Promise<WodResult> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;
  const terms = await termsForSlug(gymSlug);

  const sourceWod = await prisma.wod.findFirst({
    where: { id: sourceWodId, deletedAt: null },
    select: { title: true, content: true, teacherId: true, targetType: true, targetGroupId: true, targetStudentId: true },
  });

  if (!sourceWod || sourceWod.teacherId !== teacherId) {
    return { success: false, error: terms.wodSourceNotFound };
  }

  // Use provided target, or copy the source WOD's target
  const resolvedTarget: WodTarget = target ?? {
    type: sourceWod.targetType as WodTarget["type"],
    ...(sourceWod.targetType === "GROUP" && sourceWod.targetGroupId
      ? { groupId: sourceWod.targetGroupId }
      : {}),
    ...(sourceWod.targetType === "STUDENT" && sourceWod.targetStudentId
      ? { studentId: sourceWod.targetStudentId }
      : {}),
  } as WodTarget;

  if (!canWriteWithTarget(session.user, resolvedTarget)) {
    return { success: false, error: "No autorizado." };
  }

  const targetError = await validateTarget(resolvedTarget, teacherId);
  if (targetError) return { success: false, error: targetError };

  const wodDate = new Date(targetDate + "T00:00:00.000Z");

  const newWod = await prisma.wod.create({
    data: {
      title: sourceWod.title,
      content: sourceWod.content,
      date: wodDate,
      teacherId,
      ...targetToData(resolvedTarget),
    },
  });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  revalidatePath(gymPath(gymSlug, "/dashboard/mis-rutinas"));
  return { success: true, wodId: newWod.id };
}

export async function deleteWod(wodId: string): Promise<WodResult> {
  const session = await auth();

  if (!session?.user) {
    return { success: false, error: "No autorizado." };
  }

  const teacherId = session.user.id;
  const { gymSlug } = session.user;
  const terms = await termsForSlug(gymSlug);

  const wod = await prisma.wod.findFirst({
    where: { id: wodId, deletedAt: null },
  });

  if (!wod || wod.teacherId !== teacherId) {
    return { success: false, error: terms.wodNotFound };
  }

  if (!canWriteExisting(session.user, wod)) {
    return { success: false, error: "No autorizado." };
  }

  await prisma.wod.delete({ where: { id: wodId } });

  revalidatePath(gymPath(gymSlug, "/dashboard/teacher"));
  revalidatePath(gymPath(gymSlug, "/dashboard/athlete"));
  revalidatePath(gymPath(gymSlug, "/dashboard/mis-rutinas"));
  return { success: true };
}
