import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/UserForm";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import { BlockUserButton } from "@/components/BlockUserButton";
import { ToggleStudentTypeButton } from "@/components/ToggleStudentTypeButton";
import { AssignStudentForm } from "@/components/AssignStudentForm";
import { EditStudentButton } from "@/components/EditStudentButton";
import { PromoteTeacherButton } from "@/components/PromoteTeacherButton";
import { GroupManager } from "@/components/group/GroupManager";
import { Card } from "@/components/ui/Card";
import { formatDateArg } from "@/lib/dates";
import { gymPath } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import { getBlockStatus } from "@/lib/blocking";
import { formatMemberNumber } from "@/lib/memberNumber";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Profe",
  STUDENT: "Alumno",
};

export default async function AdminPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(gymPath(gymSlug, "/login"));
  }

  const gymId = session.user.gymId;
  const currentUserId = session.user.id;

  const [users, allGroups, teacherStudentLinks, gymConfig] = await Promise.all([
    prisma.user.findMany({
      where: { gymId, deletedAt: null },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, studentType: true, canCreateOwnRoutines: true, createdAt: true, groupMemberships: { select: { groupId: true } }, nextPaymentDate: true, blockedAt: true, memberNumber: true },
    }),
    prisma.group.findMany({
      where: { teacher: { gymId }, deletedAt: null },
      orderBy: [{ teacher: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        teacherId: true,
        teacher: { select: { name: true } },
        members: { select: { user: { select: { id: true, name: true } } } },
      },
    }),
    prisma.teacherStudent.findMany({
      where: { teacher: { gymId } },
      select: { teacherId: true, studentId: true },
    }),
    prisma.gym.findUnique({
      where: { id: gymId },
      select: { autoBlockAfterDays: true, kind: true },
    }),
  ]);

  const autoBlockAfterDays = gymConfig?.autoBlockAfterDays ?? 5;
  const terms = gymTerms(gymConfig?.kind ?? "BOX");

  const teachers = users.filter(
    (u) => u.role === "TEACHER" || u.role === "ADMIN"
  );
  const students = users.filter((u) => u.role === "STUDENT");

  const teachersById = new Map(teachers.map((t) => [t.id, { id: t.id, name: t.name }]));
  const teachersByStudentId = new Map<string, { id: string; name: string }[]>();
  for (const link of teacherStudentLinks) {
    const teacher = teachersById.get(link.teacherId);
    if (!teacher) continue;
    const list = teachersByStudentId.get(link.studentId) ?? [];
    list.push(teacher);
    teachersByStudentId.set(link.studentId, list);
  }
  const allTeacherOptions = teachers.map((t) => ({ id: t.id, name: t.name }));

  const totalTeachers = users.filter(
    (u) => u.role === "TEACHER" || u.role === "ADMIN"
  ).length;
  const totalStudents = students.length;

  return (
    <div className="flex flex-col gap-10">
      {/* Welcome banner */}
      <div className="border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
              Panel de Control
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Hola, {session.user.name?.split(" ")[0]}
            </h1>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-heading font-black text-white tabular-nums">{totalTeachers}</p>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                Profes
              </p>
            </div>
            <div className="w-px bg-elev" aria-hidden="true" />
            <div className="text-center">
              <p className="text-2xl font-heading font-black text-brand-red tabular-nums">{totalStudents}</p>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                Alumnos
              </p>
            </div>
            <div className="w-px bg-elev" aria-hidden="true" />
            <div className="text-center">
              <p className="text-2xl font-heading font-black text-white tabular-nums">{users.length}</p>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                Total
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create user + Assign students — grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="border border-line bg-panel">
          <div className="px-5 py-3 border-b border-line flex items-center gap-3">
            <span className="w-2 h-2 bg-brand-red flex-shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              Crear Usuario
            </h2>
          </div>
          <div className="p-5">
            <UserForm terms={terms} teachers={allTeacherOptions} />
          </div>
        </section>

        <section className="border border-line bg-panel">
          <div className="px-5 py-3 border-b border-line flex items-center gap-3">
            <span className="w-2 h-2 bg-brand-red flex-shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              Asignaciones
            </h2>
          </div>
          <div className="p-5">
            <AssignStudentForm
              teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
              students={students.map((s) => ({ id: s.id, name: s.name }))}
            />
          </div>
        </section>
      </div>

      {/* Groups by teacher */}
      {teachers.map((teacher) => {
        const teacherGroups = allGroups.filter((g) => g.teacherId === teacher.id);
        const assignedStudentIds = teacherStudentLinks
          .filter((l) => l.teacherId === teacher.id)
          .map((l) => l.studentId);
        const teacherStudents = students.filter(
          (s) => s.studentType === "PERSONALIZED" && assignedStudentIds.includes(s.id)
        );

        if (teacherGroups.length === 0 && teacherStudents.length === 0) return null;

        return (
          <section key={teacher.id}>
            <div className="flex items-center gap-4 mb-3">
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
                Grupos de {teacher.name}
              </h2>
              <div className="flex-1 h-px bg-elev" aria-hidden="true" />
            </div>
            <GroupManager
              groups={teacherGroups.map((g) => ({
                id: g.id,
                name: g.name,
                students: g.members.map((m) => m.user),
                availableToAdd: teacherStudents
                  .filter((s) => !s.groupMemberships.some((m) => m.groupId === g.id))
                  .map((s) => ({ id: s.id, name: s.name })),
              }))}
              hideCreate
            />
          </section>
        );
      })}

      {/* User list */}
      <section>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Usuarios
          </h2>
          <span className="text-xs font-heading font-bold text-brand-red bg-brand-red/10 px-2 py-0.5">
            {users.length}
          </span>
          <div className="flex-1 h-px bg-elev" aria-hidden="true" />
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel">
                {["Nº", "Nombre", "Email", "Rol", "Tipo", "Profes", "Alta", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const blockStatus = getBlockStatus(
                  {
                    role: user.role,
                    blockedAt: user.blockedAt,
                    nextPaymentDate: user.nextPaymentDate,
                  },
                  autoBlockAfterDays
                );
                return (
                <tr
                  key={user.id}
                  className="border-b border-line hover:bg-hover transition-colors duration-200 group"
                >
                  <td className="px-4 py-3.5 text-gray-500 font-heading font-bold text-xs tabular-nums tracking-[0.1em]">
                    {formatMemberNumber(user.memberNumber)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-elev border border-edge flex items-center justify-center flex-shrink-0 group-hover:border-brand-red/30 transition-colors duration-200">
                        <span className="text-xs font-heading font-bold text-gray-500">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white font-heading font-bold">
                        {user.name}
                        {user.id === currentUserId && (
                          <span className="ml-2 text-brand-red text-xs">(vos)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 font-body">{user.email}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={[
                          "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 inline-block",
                          user.role === "ADMIN"
                            ? "bg-brand-red/15 text-brand-red border border-brand-red/20"
                            : user.role === "TEACHER"
                            ? "bg-white/5 text-white border border-white/10"
                            : "bg-elev text-gray-400 border border-edge",
                        ].join(" ")}
                      >
                        {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                      {blockStatus.blocked && (
                        <span
                          className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 inline-block bg-brand-red/15 text-brand-red border border-brand-red/30"
                          title={
                            blockStatus.kind === "overdue"
                              ? `Auto-bloqueado: ${blockStatus.days} días de atraso`
                              : "Bloqueado manualmente"
                          }
                        >
                          {blockStatus.kind === "overdue" ? "Auto-bloq." : "Bloqueado"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {user.role === "STUDENT" ? (
                      <ToggleStudentTypeButton
                        userId={user.id}
                        currentType={user.studentType}
                        terms={terms}
                      />
                    ) : (
                      <span className="text-xs text-gray-500 font-heading">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {user.role === "STUDENT" ? (
                      (() => {
                        const ts = teachersByStudentId.get(user.id) ?? [];
                        if (ts.length === 0) {
                          return <span className="text-xs text-gray-500 font-heading">—</span>;
                        }
                        return (
                          <div className="flex flex-wrap gap-1">
                            {ts.map((t) => (
                              <span
                                key={t.id}
                                className="inline-block px-2 py-0.5 bg-elev border border-edge text-xs font-heading font-bold text-gray-300"
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-gray-500 font-heading">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 text-xs font-heading">
                    {formatDateArg(user.createdAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1 flex-wrap">
                      {user.role === "STUDENT" && (
                        <EditStudentButton
                          studentId={user.id}
                          name={user.name}
                          email={user.email}
                          nextPaymentDate={user.nextPaymentDate}
                          blocked={user.blockedAt !== null}
                          studentType={user.studentType}
                          canCreateOwnRoutines={user.canCreateOwnRoutines}
                          assignedTeachers={teachersByStudentId.get(user.id) ?? []}
                          allTeachers={allTeacherOptions}
                        />
                      )}
                      {user.role === "TEACHER" && (
                        <PromoteTeacherButton
                          user={{ id: user.id, name: user.name, blockedAt: user.blockedAt }}
                        />
                      )}
                      <BlockUserButton
                        userId={user.id}
                        currentUserId={currentUserId}
                        userRole={user.role}
                        blocked={user.blockedAt !== null}
                      />
                      <DeleteUserButton
                        userId={user.id}
                        currentUserId={currentUserId}
                      />
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden flex flex-col gap-3">
          {users.map((user) => {
            const blockStatus = getBlockStatus(
              {
                role: user.role,
                blockedAt: user.blockedAt,
                nextPaymentDate: user.nextPaymentDate,
              },
              autoBlockAfterDays
            );
            return (
            <Card key={user.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 bg-panel border border-edge flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-heading font-bold text-gray-500">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-white font-heading font-bold text-sm truncate">
                      <span className="text-gray-500 mr-2 tabular-nums tracking-[0.1em]">
                        {formatMemberNumber(user.memberNumber)}
                      </span>
                      {user.name}
                      {user.id === currentUserId && (
                        <span className="ml-1 text-brand-red text-xs">(vos)</span>
                      )}
                    </p>
                    <p className="text-gray-500 text-xs font-body truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className={[
                          "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5",
                          user.role === "ADMIN"
                            ? "bg-brand-red/15 text-brand-red border border-brand-red/20"
                            : user.role === "TEACHER"
                            ? "bg-white/5 text-white border border-white/10"
                            : "bg-elev text-gray-400 border border-edge",
                        ].join(" ")}
                      >
                        {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                      {user.role === "STUDENT" && (
                        <ToggleStudentTypeButton
                          userId={user.id}
                          currentType={user.studentType}
                          terms={terms}
                        />
                      )}
                      {blockStatus.blocked && (
                        <span
                          className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-brand-red/15 text-brand-red border border-brand-red/30"
                          title={
                            blockStatus.kind === "overdue"
                              ? `Auto-bloqueado: ${blockStatus.days} días de atraso`
                              : "Bloqueado manualmente"
                          }
                        >
                          {blockStatus.kind === "overdue" ? "Auto-bloq." : "Bloqueado"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                  {user.role === "STUDENT" && (
                    <EditStudentButton
                      studentId={user.id}
                      name={user.name}
                      email={user.email}
                      nextPaymentDate={user.nextPaymentDate}
                      studentType={user.studentType}
                      canCreateOwnRoutines={user.canCreateOwnRoutines}
                      assignedTeachers={teachersByStudentId.get(user.id) ?? []}
                      allTeachers={allTeacherOptions}
                    />
                  )}
                  {user.role === "TEACHER" && (
                    <PromoteTeacherButton
                      user={{ id: user.id, name: user.name, blockedAt: user.blockedAt }}
                    />
                  )}
                  <BlockUserButton
                    userId={user.id}
                    currentUserId={currentUserId}
                    userRole={user.role}
                    blocked={user.blockedAt !== null}
                  />
                  <DeleteUserButton
                    userId={user.id}
                    currentUserId={currentUserId}
                  />
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
