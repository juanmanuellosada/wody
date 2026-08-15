import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath, hasAccessControl, isPersonalGym } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import { formatMemberNumber } from "@/lib/memberNumber";
import { WodManagerClient } from "@/components/wod/WodManagerClient";
import { GroupManager } from "@/components/group/GroupManager";
import { CheckinScannerButton } from "@/components/access/CheckinScannerButton";
import { FixedRoutineManager } from "@/components/fixed-routine/FixedRoutineManager";
import { getTeacherRenewalRoutines, getGymRenewalRoutines } from "@/actions/fixed-routine";
import { isTrainingModuleEnabled } from "@/lib/gym-module-guards";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function TeacherDashboardPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (session?.user && session.user.gymKind && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  // Con trainingEnabled apagado, el acceso directo por URL se rechaza (no
  // solo se oculta del menú). Ya descartamos isPersonalGym arriba: D7 no
  // afecta esa rama.
  if (!(await isTrainingModuleEnabled(gymSlug))) {
    redirect(gymPath(gymSlug, "/beneficios"));
  }

  const teacherId = session.user.id;
  const role = session.user.role;

  // Fetch gym first to determine kind and gymId for admin-scoped queries.
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug }, select: { id: true, kind: true } });
  const isGym = gym?.kind === "GYM";
  const gymId = gym?.id;

  const [wods, groups, myStudents, teacher, renewalRoutines, allMuslibStudents] = await Promise.all([
    prisma.wod.findMany({
      where: { teacherId, deletedAt: null },
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        date: true,
        targetType: true,
        targetGroupId: true,
        targetStudentId: true,
        targetGroup: { select: { name: true } },
        targetStudent: { select: { name: true } },
      },
    }),
    prisma.group.findMany({
      where: { teacherId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, members: { select: { user: { select: { id: true, name: true } } } } },
    }),
    prisma.teacherStudent.findMany({
      where: { teacherId },
      select: { student: { select: { id: true, name: true, studentType: true, groupMemberships: { select: { groupId: true } } } } },
    }),
    prisma.user.findUnique({ where: { id: teacherId }, select: { memberNumber: true } }),
    // ADMIN sees all gym renewal routines; TEACHER sees only their own.
    role === "ADMIN" && gymId
      ? getGymRenewalRoutines(gymId)
      : getTeacherRenewalRoutines(teacherId),
    // ADMIN: all muslib students in the gym (not filtered by TeacherStudent link).
    role === "ADMIN" && isGym && gymId
      ? prisma.user.findMany({
          where: { gymId, studentType: "MUSCULACION_LIBRE", deletedAt: null, role: "STUDENT" },
          select: { id: true, name: true, groupMemberships: { select: { groupId: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve(null),
  ]);
  const terms = gymTerms(gym?.kind ?? "BOX");

  const wodsForClient = wods.map((w) => ({
    ...w,
    targetGroupName: w.targetGroup?.name ?? null,
    targetStudentName: w.targetStudent?.name ?? null,
  }));

  const personalizedStudents = myStudents
    .filter((ts) => ts.student.studentType === "PERSONALIZED")
    .map((ts) => ({
      id: ts.student.id,
      name: ts.student.name,
      groupIds: ts.student.groupMemberships.map((m) => m.groupId),
    }));

  // Candidates for group membership: PERSONALIZED + MUSCULACION_LIBRE.
  // For ADMIN: use all muslib from the gym; for TEACHER: from their linked students.
  const muslibForGroups = isGym
    ? role === "ADMIN" && allMuslibStudents !== null
      ? allMuslibStudents.map((s) => ({
          id: s.id,
          name: s.name,
          groupIds: s.groupMemberships.map((m) => m.groupId),
        }))
      : myStudents
          .filter((ts) => ts.student.studentType === "MUSCULACION_LIBRE")
          .map((ts) => ({
            id: ts.student.id,
            name: ts.student.name,
            groupIds: ts.student.groupMemberships.map((m) => m.groupId),
          }))
    : [];
  const groupCandidates = [...personalizedStudents, ...muslibForGroups];

  const muslibStudents = isGym
    ? role === "ADMIN" && allMuslibStudents !== null
      ? allMuslibStudents
      : myStudents
          .filter((ts) => ts.student.studentType === "MUSCULACION_LIBRE")
          .map((ts) => ({ id: ts.student.id, name: ts.student.name }))
    : [];

  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="flex flex-col gap-8">
      {hasAccessControl(gymSlug) && (
        <div className="flex flex-col gap-3">
          <CheckinScannerButton gymSlug={gymSlug} />
          <div className="border border-line bg-panel p-4 flex items-center justify-between gap-3">
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-500">
              Tu número de socio
            </p>
            <p className="text-xl font-heading font-black text-white tabular-nums tracking-[0.15em]">
              {formatMemberNumber(teacher?.memberNumber ?? 0)}
            </p>
          </div>
        </div>
      )}
      {/* Welcome header */}
      <div className="border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
              Dashboard Profe
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Hola, {session.user.name?.split(" ")[0]}
            </h1>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-heading font-black text-brand-red">{wods.length}</p>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                {wods.length === 1 ? terms.wod : terms.wods}
              </p>
            </div>
            <div className="w-px bg-elev" aria-hidden="true" />
            <div className="text-center">
              <p className="text-3xl font-heading font-black text-white">{groups.length}</p>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                {groups.length === 1 ? "Grupo" : "Grupos"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Group manager */}
      <GroupManager
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          students: g.members.map((m) => m.user),
          availableToAdd: groupCandidates.filter((s) => !s.groupIds.includes(g.id)),
        }))}
      />

      {/* Fixed routine manager — GYM only */}
      {isGym && (
        <FixedRoutineManager
          muslibStudents={muslibStudents}
          renewalRoutines={renewalRoutines}
        />
      )}

      {/* WOD manager */}
      <WodManagerClient
        wods={wodsForClient}
        groups={groupOptions}
        students={personalizedStudents}
        muslibStudents={isGym ? muslibStudents : undefined}
        terms={terms}
      />
    </div>
  );
}
