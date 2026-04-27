import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina, toInputDate, formatDateArg } from "@/lib/dates";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { ShareWodButton } from "@/components/wod/ShareWodButton";
import { StudentWodBadge } from "@/components/wod/StudentWodBadge";
import { gymPath } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import Link from "next/link";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function WodFullPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

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
  const isToday = toInputDate(wod.date) === toInputDate(getTodayArgentina());

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          href={athletePath}
          className="text-xs text-gray-600 hover:text-brand-red uppercase tracking-[0.15em] font-heading font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer"
        >
          <span aria-hidden="true">&#8592;</span> Volver
        </Link>
        <ShareWodButton
          title={wod.title}
          content={wod.content}
          dateLabel={dateLabel}
          gymName={gym?.name}
        />
      </div>

      {/* Full WOD */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          {/* Date header */}
          <div className="flex items-center gap-3 mb-6">
            {isToday && (
              <span className="inline-block w-2.5 h-2.5 bg-brand-red flex-shrink-0 animate-pulse" aria-hidden="true" />
            )}
            <h1 className="text-2xl sm:text-4xl font-heading font-black uppercase tracking-[0.1em] text-white">
              {isToday ? wod.title : dateLabel}
            </h1>
          </div>

          {isToday ? (
            <p className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-brand-red mb-2">
              {dateLabel}
            </p>
          ) : (
            <p className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
              {wod.title}
            </p>
          )}

          {/* Separator */}
          <div className="w-12 h-1 bg-brand-red mb-6" aria-hidden="true" />

          <div className="mb-8">
            <StudentWodBadge
              targetType={wod.targetType as "ALL" | "PERSONALIZED" | "GROUP" | "STUDENT"}
              targetGroupName={wod.targetGroup?.name ?? null}
              isOwn={wod.teacherId === studentId}
            />
          </div>

          {/* Content — large readable text */}
          <MarkdownRenderer
            content={wod.content}
            className="text-base sm:text-lg [&_h1]:text-2xl [&_h1]:sm:text-3xl [&_h2]:text-xl [&_h2]:sm:text-2xl [&_li]:text-base [&_li]:sm:text-lg [&_p]:text-base [&_p]:sm:text-lg"
          />
        </div>
      </div>
    </div>
  );
}
