export type FeeRole = "ADMIN" | "TEACHER";
export type FeeGymKind = "BOX" | "GYM" | "PERSONAL";
export type FeeStudentType = "GENERAL" | "PERSONALIZED" | "MUSCULACION_LIBRE";
export type FeeStatusFilter = "all" | "overdue" | "due-soon" | "ok" | "exempt";
export type FeeStatusKind = Exclude<FeeStatusFilter, "all" | "exempt">;

export type FeeTeacher = { id: string; name: string };

/** Date-only DTOs are always YYYY-MM-DD, interpreted as UTC midnight. */
export type FeeStudent = {
  id: string;
  name: string;
  email: string | null;
  nextPaymentDate: string;
  studentType: FeeStudentType;
  accountKind?: "FULL" | "LITE";
  canCreateOwnRoutines?: boolean;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  assignedTeachers: FeeTeacher[];
  blocked: boolean;
  deletedAt?: string | null;
};

export type FeeIdentity = {
  id: string;
  role: FeeRole;
  name: string;
};

export type FeeStatus = { kind: FeeStatusKind; days: number };
export type FeeBlockStatus =
  | { blocked: false }
  | { blocked: true; kind: "manual" }
  | { blocked: true; kind: "overdue"; days: number };

export type FeeProjection = {
  rows: Array<FeeStudent & { status: FeeStatus | null }>;
  counts: Record<FeeStatusFilter, number>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcMidnight(dateOnly: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) throw new Error(`Expected a date-only DTO, received ${dateOnly}`);
  const [, year, month, day] = match;
  const value = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const check = new Date(value);
  if (
    check.getUTCFullYear() !== Number(year)
    || check.getUTCMonth() + 1 !== Number(month)
    || check.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Expected a valid date-only DTO, received ${dateOnly}`);
  }
  return value;
}

export function getFeeStatus(nextPaymentDate: string, today: string): FeeStatus {
  const days = Math.round((utcMidnight(nextPaymentDate) - utcMidnight(today)) / MS_PER_DAY);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days <= 7) return { kind: "due-soon", days };
  return { kind: "ok", days };
}

export function getFeeBlockStatus(
  student: Pick<FeeStudent, "blocked" | "nextPaymentDate">,
  today: string,
  autoBlockAfterDays: number,
): FeeBlockStatus {
  if (student.blocked) return { blocked: true, kind: "manual" };
  const daysOverdue = Math.round((utcMidnight(today) - utcMidnight(student.nextPaymentDate)) / MS_PER_DAY);
  if (daysOverdue > autoBlockAfterDays) return { blocked: true, kind: "overdue", days: daysOverdue };
  return { blocked: false };
}

/** Mirrors the server query: admins see active students; teachers see only their active assignments. */
export function selectFeeStudents(students: FeeStudent[], identity: FeeIdentity): FeeStudent[] {
  return students.filter((student) =>
    !student.deletedAt
    && (identity.role === "ADMIN" || student.assignedTeachers.some((teacher) => teacher.id === identity.id))
  );
}

/** Applies status first and type second, matching the Cuotas page's count and filter semantics. */
export function projectFeeStudents(
  students: FeeStudent[],
  today: string,
  activeFilter: FeeStatusFilter,
  activeType: FeeStudentType | "",
): FeeProjection {
  const nonExempt = students.filter((student) => !student.paymentExempt);
  const overdue = nonExempt.filter((student) => getFeeStatus(student.nextPaymentDate, today).kind === "overdue");
  const dueSoon = nonExempt.filter((student) => getFeeStatus(student.nextPaymentDate, today).kind === "due-soon");
  const counts = {
    all: students.length,
    overdue: overdue.length,
    "due-soon": dueSoon.length,
    ok: nonExempt.length - overdue.length - dueSoon.length,
    exempt: students.length - nonExempt.length,
  };
  const statusFiltered = activeFilter === "all"
    ? students
    : activeFilter === "exempt"
      ? students.filter((student) => student.paymentExempt)
      : nonExempt.filter((student) => getFeeStatus(student.nextPaymentDate, today).kind === activeFilter);
  const typedRows = activeType
    ? statusFiltered.filter((student) => student.studentType === activeType)
    : statusFiltered;

  return {
    rows: typedRows.map((student) => ({
      ...student,
      status: student.paymentExempt ? null : getFeeStatus(student.nextPaymentDate, today),
    })),
    counts,
  };
}

export function parseFeeStatusFilter(value: string | undefined): FeeStatusFilter {
  if (value === "overdue" || value === "due-soon" || value === "ok" || value === "exempt") return value;
  return "all";
}

export function parseFeeStudentType(value: string | undefined): FeeStudentType | "" {
  if (value === "GENERAL" || value === "PERSONALIZED" || value === "MUSCULACION_LIBRE") return value;
  return "";
}
