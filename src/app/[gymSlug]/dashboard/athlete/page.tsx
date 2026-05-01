import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, UserPlus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import { WodCard } from "@/components/wod/WodCard";
import { WodHistory } from "@/components/wod/WodHistory";
import { gymPath, hasAccessControl, isPersonalGym } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import { formatMemberNumber } from "@/lib/memberNumber";
import { CheckinScannerButton } from "@/components/access/CheckinScannerButton";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function StudentDashboardPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (session?.user && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (!session?.user || session.user.role !== "STUDENT") {
    redirect(gymPath(gymSlug, "/login"));
  }

  const studentId = session.user.id;
  const canCreateOwn = session.user.canCreateOwnRoutines;
  const todayStr = toInputDate(getTodayArgentina());

  const [teacherLinks, student, gym] = await Promise.all([
    prisma.teacherStudent.findMany({
      where: { studentId },
      select: { teacherId: true },
    }),
    prisma.user.findUnique({
      where: { id: studentId },
      select: { memberNumber: true, studentType: true, groupMemberships: { select: { groupId: true } } },
    }),
    prisma.gym.findUnique({ where: { slug: gymSlug }, select: { kind: true } }),
  ]);
  const terms = gymTerms(gym?.kind ?? "BOX");
  const teacherIds = teacherLinks.map((l) => l.teacherId);

  const accessCard = student && hasAccessControl(gymSlug) ? (
    <div className="flex flex-col gap-3">
      <CheckinScannerButton gymSlug={gymSlug} />
      <div className="border border-line bg-panel p-4 flex items-center justify-between gap-3">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-500">
          Tu número de socio
        </p>
        <p className="text-xl font-heading font-black text-white tabular-nums tracking-[0.15em]">
          {formatMemberNumber(student.memberNumber)}
        </p>
      </div>
    </div>
  ) : null;

  const wodPath = gymPath(gymSlug, "/dashboard/athlete/wod");

  // Student aún sin profe y sin autogestión habilitada: onboarding (no paywall).
  if (teacherIds.length === 0 && !canCreateOwn) {
    return (
      <div className="flex flex-col gap-10">
        {accessCard}
        <section>
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white mb-5">
            {terms.wod} de Hoy
          </h1>
          <div className="border border-edge bg-panel p-8 sm:p-12 flex flex-col items-center text-center gap-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-red/10 border border-brand-red/30">
              <UserPlus size={26} className="text-brand-red" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-2 max-w-sm">
              <p className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white">
                Aún sin profe asignado
              </p>
              <p className="text-sm text-gray-400 font-body leading-relaxed">
                Tu profe todavía no te conectó con su lista. Avisale para que te
                asigne y empieces a ver tu rutina del día.
              </p>
            </div>
            <Link
              href={gymPath(gymSlug, "/dashboard/rms")}
              className="mt-1 inline-block px-6 py-3 font-heading font-bold uppercase tracking-[0.15em] text-white text-xs bg-brand-red hover:bg-brand-red-dark transition-colors duration-200"
            >
              Mientras tanto, cargá tus {terms.rms}
            </Link>
          </div>
        </section>
      </div>
    );
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

  const allWods = await prisma.wod.findMany({
    where: { OR: [...teacherWodClause, ...selfWodClause], deletedAt: null },
    orderBy: { date: "desc" },
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

  const wodsWithAssignment = allWods.map((w) => ({
    ...w,
    assignment: {
      targetType: w.targetType as "ALL" | "PERSONALIZED" | "GROUP" | "STUDENT",
      targetGroupName: w.targetGroup?.name ?? null,
      isOwn: w.teacherId === studentId,
    },
  }));

  const todayWods = wodsWithAssignment.filter((w) => toInputDate(w.date) === todayStr);
  const historyWods = wodsWithAssignment.filter((w) => toInputDate(w.date) !== todayStr);

  return (
    <div className="flex flex-col gap-10">
      {accessCard}
      {/* Today's WODs */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
            {todayWods.length > 1 ? `${terms.wods} de Hoy` : `${terms.wod} de Hoy`}
          </h1>
        </div>
        {todayWods.length > 0 ? (
          <div className="flex flex-col gap-4">
            {todayWods.map((wod) => (
              <Link
                key={wod.id}
                href={`${wodPath}?id=${wod.id}`}
                className="block cursor-pointer group"
              >
                <WodCard wod={wod} highlight assignment={wod.assignment} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-edge p-8 text-center flex flex-col items-center gap-3">
            <Calendar size={28} className="text-gray-600" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-gray-500 text-sm font-heading font-bold uppercase tracking-[0.15em]">
                No hay {terms.wod} para hoy
              </p>
              <p className="text-gray-500 text-xs font-body">
                Hablá con tu profe
              </p>
            </div>
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Historial
          </h2>
          <div className="flex-1 h-px bg-elev" aria-hidden="true" />
        </div>
        <WodHistory wods={historyWods} wodPath={wodPath} terms={terms} />
      </section>
    </div>
  );
}
