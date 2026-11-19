import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina, toInputDate, formatDateArg } from "@/lib/dates";
import { ShareWodButton } from "@/components/wod/ShareWodButton";
import { StudentWodDetailView } from "@/components/wod/StudentWodDetailView";
import { gymPath, isPersonalGym } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import Link from "next/link";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function WodFullPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (session?.user && session.user.gymKind && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (!session?.user || session.user.role !== "STUDENT") {
    redirect(gymPath(gymSlug, "/login"));
  }

  const { id: wodId } = await searchParams;
  const studentId = session.user.id;
  const canCreateOwn = session.user.canCreateOwnRoutines;
  const athletePath = gymPath(gymSlug, "/dashboard/athlete");

  // Find all teachers assigned to this student
  const teacherLinks = await prisma.teacherStudent.findMany({
    where: { studentId },
    select: { teacherId: true },
  });
  const teacherIds = teacherLinks.map((l) => l.teacherId);

  if (teacherIds.length === 0 && !canCreateOwn) {
    redirect(athletePath);
  }

  const [student, gym] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { studentType: true, groupMemberships: { select: { groupId: true } } },
    }),
    prisma.gym.findUnique({ where: { slug: gymSlug }, select: { name: true, kind: true } }),
  ]);
  const terms = gymTerms(gym?.kind ?? "BOX");

  // MUSCULACION_LIBRE students don't get WODs — redirect to their fixed routine view
  if (student?.studentType === "MUSCULACION_LIBRE") {
    redirect(athletePath);
  }

  const isPersonalized = student?.studentType === "PERSONALIZED";
  const groupIds = student?.groupMemberships?.map((m) => m.groupId) ?? [];

  const teacherWodClause = teacherIds.length > 0
    ? [{
        teacherId: { in: teacherIds },
        OR: [
          { targetType: "ALL" as const },
          ...(isPersonalized
            ? [
                { targetType: "PERSONALIZED" as const },
                ...(groupIds.length > 0
                  ? [{ targetType: "GROUP" as const, targetGroupId: { in: groupIds } }]
                  : []),
                { targetType: "STUDENT" as const, targetStudentId: studentId },
              ]
            : []),
        ],
      }]
    : [];

  const selfWodClause = canCreateOwn
    ? [{
        teacherId: studentId,
        targetType: "STUDENT" as const,
        targetStudentId: studentId,
      }]
    : [];

  const visibleClause = { OR: [...teacherWodClause, ...selfWodClause] };

  let wod;

  if (wodId) {
    // Specific WOD by ID — verify the student has visibility on it
    wod = await prisma.wod.findFirst({
      where: { id: wodId, deletedAt: null, ...visibleClause },
      select: {
        id: true,
        title: true,
        content: true,
        date: true,
        teacherId: true,
        targetType: true,
        targetGroup: { select: { name: true } },
      },
    });
    if (!wod) {
      redirect(athletePath);
    }
  } else {
    // Default: today's WOD — fetch and compare date strings to bypass
    // Prisma/pg timezone ambiguity with @db.Date columns
    const todayStr = toInputDate(getTodayArgentina());
    const visibleWods = await prisma.wod.findMany({
      where: { ...visibleClause, deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        date: true,
        teacherId: true,
        targetType: true,
        targetGroup: { select: { name: true } },
      },
    });
    wod = visibleWods.find((w) => toInputDate(w.date) === todayStr) ?? null;
  }

  if (!wod) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-gray-500 text-lg font-heading font-bold uppercase tracking-[0.15em]">
          No hay {terms.wod} para mostrar
        </p>
        <Link
          href={athletePath}
          className="mt-4 text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red hover:text-white transition-colors duration-200 cursor-pointer"
        >
          Volver al dashboard
        </Link>
      </div>
    );
  }

  const dateLabel = formatDateArg(wod.date);

  return (
    <StudentWodDetailView
      wod={{
        ...wod,
        targetType: wod.targetType as "ALL" | "PERSONALIZED" | "GROUP" | "STUDENT",
        targetGroupName: wod.targetGroup?.name ?? null,
      }}
      studentId={studentId}
      backHref={athletePath}
      shareAction={(
        <ShareWodButton
          title={wod.title}
          content={wod.content}
          dateLabel={dateLabel}
          gymName={gym?.name}
        />
      )}
    />
  );
}
