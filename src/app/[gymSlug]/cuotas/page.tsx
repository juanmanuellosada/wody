import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath, isPersonalGym } from "@/lib/gym";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import { EditStudentButton } from "@/components/EditStudentButton";
import { BlockUserButton } from "@/components/BlockUserButton";
import { StudentTypeSelect } from "@/components/StudentTypeSelect";
import { PaymentControlView } from "@/components/payments/PaymentControlView";
import { getBlockStatus } from "@/lib/blocking";
import { projectFeeStudents, type FeeStatusFilter, type FeeStudentType } from "@/components/demo/finance/fees-contract";
import type { StudentType } from "@prisma/client";

type StatusFilter = FeeStatusFilter;

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{
    status?: string;
    type?: string;
  }>;
}

function parseFilter(value: string | undefined): StatusFilter {
  if (value === "overdue" || value === "due-soon" || value === "ok" || value === "exempt") {
    return value;
  }
  return "all";
}

const VALID_STUDENT_TYPES: StudentType[] = ["GENERAL", "PERSONALIZED", "MUSCULACION_LIBRE"];

function parseTypeFilter(value: string | undefined): StudentType | "" {
  return VALID_STUDENT_TYPES.includes(value as StudentType) ? (value as StudentType) : "";
}

type PaymentRow = {
  id: string;
  name: string;
  email: string | null;
  nextPaymentDate: Date;
  blockedAt: Date | null;
  studentType: StudentType;
  canCreateOwnRoutines: boolean;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  assignedTeachers: { id: string; name: string }[];
};

export default async function PaymentsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const { status: statusParam, type: typeParam } = await searchParams;
  const activeFilter = parseFilter(statusParam);
  const activeType = parseTypeFilter(typeParam);
  const session = await auth();

  if (session?.user && session.user.gymKind && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  if (!session.user.gymId) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const gymId = session.user.gymId;
  const isAdmin = session.user.role === "ADMIN";

  const [students, teacherLinks, teachers, gymConfig] = await Promise.all([
    isAdmin
      ? prisma.user.findMany({
          where: { gymId, role: "STUDENT", deletedAt: null },
          orderBy: { nextPaymentDate: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            nextPaymentDate: true,
            blockedAt: true,
            studentType: true,
            canCreateOwnRoutines: true,
            paymentExempt: true,
            paymentExemptReason: true,
          },
        })
      : prisma.user.findMany({
          where: {
            gymId,
            role: "STUDENT",
            deletedAt: null,
            studentOf: { some: { teacherId: session.user.id } },
          },
          orderBy: { nextPaymentDate: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            nextPaymentDate: true,
            blockedAt: true,
            studentType: true,
            canCreateOwnRoutines: true,
            paymentExempt: true,
            paymentExemptReason: true,
          },
        }),
    prisma.teacherStudent.findMany({
      where: { teacher: { gymId } },
      select: { teacherId: true, studentId: true },
    }),
    prisma.user.findMany({
      where: { gymId, deletedAt: null, OR: [{ role: "TEACHER" }, { role: "ADMIN" }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.gym.findUnique({
      where: { id: gymId },
      select: { autoBlockAfterDays: true, kind: true },
    }),
  ]);

  const autoBlockAfterDays = gymConfig?.autoBlockAfterDays ?? 45;

  // Batch-fetch active fixed routines for MUSCULACION_LIBRE students (GYM only). Avoids N+1.
  const muslibActiveRoutinesByStudentId = new Map<string, { id: string; renewAt: Date }>();
  if (gymConfig?.kind === "GYM") {
    const muslibStudentIds = students
      .filter((student) => student.studentType === "MUSCULACION_LIBRE")
      .map((student) => student.id);
    if (muslibStudentIds.length > 0) {
      const routines = await prisma.fixedRoutine.findMany({
        where: { studentId: { in: muslibStudentIds }, gymId, deletedAt: null },
        orderBy: { assignedAt: "desc" },
        select: { id: true, studentId: true, renewAt: true },
      });
      for (const routine of routines) {
        if (!muslibActiveRoutinesByStudentId.has(routine.studentId)) {
          muslibActiveRoutinesByStudentId.set(routine.studentId, { id: routine.id, renewAt: routine.renewAt });
        }
      }
    }
  }

  const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const teachersByStudentId = new Map<string, { id: string; name: string }[]>();
  for (const link of teacherLinks) {
    const teacher = teachersById.get(link.teacherId);
    if (!teacher) continue;
    const list = teachersByStudentId.get(link.studentId) ?? [];
    list.push(teacher);
    teachersByStudentId.set(link.studentId, list);
  }

  const today = getTodayArgentina();
  const rows: PaymentRow[] = students.map((student) => ({
    ...student,
    assignedTeachers: teachersByStudentId.get(student.id) ?? [],
  }));
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const feeRows = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    nextPaymentDate: toInputDate(row.nextPaymentDate),
    studentType: row.studentType as FeeStudentType,
    canCreateOwnRoutines: row.canCreateOwnRoutines,
    paymentExempt: row.paymentExempt,
    paymentExemptReason: row.paymentExemptReason,
    assignedTeachers: row.assignedTeachers,
    blocked: row.blockedAt !== null,
  }));
  const projection = projectFeeStudents(feeRows, toInputDate(today), activeFilter, activeType);
  const presentationRows = projection.rows.map((row) => {
    const source = rowsById.get(row.id)!;
    return {
      ...row,
      blockStatus: getBlockStatus(
        { role: "STUDENT", blockedAt: source.blockedAt, nextPaymentDate: source.nextPaymentDate },
        autoBlockAfterDays,
        today,
      ),
    };
  });

  const basePath = gymPath(gymSlug, "/cuotas");
  const filterHref = (filter: StatusFilter) => {
    const query = new URLSearchParams();
    if (filter !== "all") query.set("status", filter);
    if (activeType) query.set("type", activeType);
    const serialized = query.toString();
    return serialized ? `${basePath}?${serialized}` : basePath;
  };
  const statusTiles: StatusFilter[] = ["all", "overdue", "due-soon", "ok", "exempt"];
  const rowActions = Object.fromEntries(presentationRows.map((row) => {
    const source = rowsById.get(row.id)!;
    return [row.id, (
      <>
        <EditStudentButton
          studentId={source.id}
          name={source.name}
          email={source.email}
          nextPaymentDate={source.nextPaymentDate}
          blocked={source.blockedAt !== null}
          studentType={source.studentType}
          canCreateOwnRoutines={source.canCreateOwnRoutines}
          paymentExempt={source.paymentExempt}
          paymentExemptReason={source.paymentExemptReason}
          assignedTeachers={source.assignedTeachers}
          allTeachers={teachers}
          isAdmin={isAdmin}
          gymKind={gymConfig?.kind}
          activeRoutineId={muslibActiveRoutinesByStudentId.get(source.id)?.id ?? null}
          routineRenewAt={muslibActiveRoutinesByStudentId.get(source.id)?.renewAt ?? null}
        />
        {isAdmin && (
          <BlockUserButton
            userId={source.id}
            currentUserId={session.user.id}
            userRole="STUDENT"
            blocked={source.blockedAt !== null}
          />
        )}
      </>
    )];
  }));

  return (
    <PaymentControlView
      rows={presentationRows}
      counts={projection.counts}
      activeFilter={activeFilter}
      typeControl={<StudentTypeSelect gymKind={gymConfig?.kind} paramName="type" value={activeType} />}
      statusTiles={statusTiles.map((key) => ({ key, href: filterHref(key) }))}
      emptyMessage={rows.length === 0
        ? isAdmin ? "No hay alumnos cargados todavía." : "No tenés alumnos asignados."
        : "No hay alumnos en este estado."}
      rowActions={rowActions}
    />
  );
}
