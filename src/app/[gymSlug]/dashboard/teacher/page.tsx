import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { WodManagerClient } from "@/components/wod/WodManagerClient";
import { GroupManager } from "@/components/group/GroupManager";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function TeacherDashboardPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (
    !session?.user ||
    session.user.gymSlug !== gymSlug ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const teacherId = session.user.id;

  const [wods, groups, myStudents] = await Promise.all([
    prisma.wod.findMany({
      where: { teacherId },
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
      where: { teacherId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, students: { select: { id: true, name: true } } },
    }),
    prisma.teacherStudent.findMany({
      where: { teacherId },
      select: { student: { select: { id: true, name: true, studentType: true, groupId: true } } },
    }),
  ]);

  const wodsForClient = wods.map((w) => ({
    ...w,
    targetGroupName: w.targetGroup?.name ?? null,
    targetStudentName: w.targetStudent?.name ?? null,
  }));

  const personalizedStudents = myStudents
    .filter((ts) => ts.student.studentType === "PERSONALIZED")
    .map((ts) => ({ id: ts.student.id, name: ts.student.name }));

  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome header */}
      <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 sm:p-8">
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
                {wods.length === 1 ? "WOD" : "WODs"}
              </p>
            </div>
            <div className="w-px bg-[#1A1A1A]" aria-hidden="true" />
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
          students: g.students,
        }))}
        ungroupedStudents={personalizedStudents.filter(
          (s) => !myStudents.find((ts) => ts.student.id === s.id && ts.student.groupId)
        )}
      />

      {/* WOD manager */}
      <WodManagerClient
        wods={wodsForClient}
        groups={groupOptions}
        students={personalizedStudents}
      />
    </div>
  );
}
