import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath, isPersonalGym } from "@/lib/gym";
import { addOneMonth, getTodayArgentina, toInputDate } from "@/lib/dates";
import { RegisterPaymentButton } from "@/components/RegisterPaymentSection";
import { RevenuePanel } from "@/components/RevenuePanel";
import type { PaymentStudent } from "@/components/RegisterPaymentDialog";
import type { PaymentStatsFilters, PaymentMethod } from "@/lib/payment-stats";
import type { StudentType } from "@prisma/client";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{
    statsFrom?: string;
    statsTo?: string;
    statsTeacherIds?: string;
    statsMethods?: string;
    statsStudentType?: string;
  }>;
}

const VALID_METHODS: PaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];
const VALID_STUDENT_TYPES: StudentType[] = ["GENERAL", "PERSONALIZED", "MUSCULACION_LIBRE"];

/** Parses stats filter params (always range mode). Defaults to current full month. */
function parseStatsFilters(sp: {
  statsFrom?: string;
  statsTo?: string;
  statsTeacherIds?: string;
  statsMethods?: string;
  statsStudentType?: string;
}): {
  from: Date;
  to: Date;
  fromStr: string;
  toStr: string;
  teacherIds: string[];
  methodIds: PaymentMethod[];
  studentType: StudentType | "";
} {
  const today = getTodayArgentina();
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
  const lastOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), lastDay));

  const defaultFromStr = toInputDate(firstOfMonth);
  const defaultToStr = toInputDate(lastOfMonth);

  const fromStr =
    /^\d{4}-\d{2}-\d{2}$/.test(sp.statsFrom ?? "") ? sp.statsFrom! : defaultFromStr;
  const toStr =
    /^\d{4}-\d{2}-\d{2}$/.test(sp.statsTo ?? "") ? sp.statsTo! : defaultToStr;

  const from = new Date(`${fromStr}T00:00:00.000Z`);
  const to = new Date(`${toStr}T23:59:59.999Z`);

  const teacherIds: string[] = sp.statsTeacherIds
    ? sp.statsTeacherIds.split(",").filter(Boolean)
    : [];

  const methodIds: PaymentMethod[] = sp.statsMethods
    ? sp.statsMethods.split(",").filter((m): m is PaymentMethod => VALID_METHODS.includes(m as PaymentMethod))
    : [];

  const studentType: StudentType | "" = VALID_STUDENT_TYPES.includes(sp.statsStudentType as StudentType)
    ? (sp.statsStudentType as StudentType)
    : "";

  return { from, to, fromStr, toStr, teacherIds, methodIds, studentType };
}

export default async function CajaPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const { statsFrom, statsTo, statsTeacherIds, statsMethods, statsStudentType } = await searchParams;
  const statsParsed = parseStatsFilters({ statsFrom, statsTo, statsTeacherIds, statsMethods, statsStudentType });
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

  // Lee canViewRevenue fresco desde la DB (no confiar solo en el token, que
  // puede estar stale si el admin fue designado/revocado recién).
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canViewRevenue: true },
  });
  const showRevenue = isAdmin && dbUser?.canViewRevenue === true;

  const [students, lastPayments, teachers, gymConfig] = await Promise.all([
    isAdmin
      ? prisma.user.findMany({
          where: { gymId, role: "STUDENT", deletedAt: null },
          select: {
            id: true,
            name: true,
            nextPaymentDate: true,
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
          select: {
            id: true,
            name: true,
            nextPaymentDate: true,
            paymentExempt: true,
            paymentExemptReason: true,
          },
        }),
    prisma.payment.findMany({
      where: { gymId },
      orderBy: { paidAt: "desc" },
      select: { studentId: true, amount: true },
    }),
    prisma.user.findMany({
      where: { gymId, deletedAt: null, OR: [{ role: "TEACHER" }, { role: "ADMIN" }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.gym.findUnique({
      where: { id: gymId },
      select: { kind: true },
    }),
  ]);

  const lastAmountByStudentId = new Map<string, number>();
  for (const p of lastPayments) {
    if (!lastAmountByStudentId.has(p.studentId)) {
      lastAmountByStudentId.set(p.studentId, Number(p.amount));
    }
  }

  const paymentStudents: PaymentStudent[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    suggestedNextDate: toInputDate(addOneMonth(s.nextPaymentDate)),
    lastAmount: lastAmountByStudentId.get(s.id) ?? null,
    paymentExempt: s.paymentExempt,
    paymentExemptReason: s.paymentExemptReason,
  }));

  const statsFilters: PaymentStatsFilters = {
    gymId,
    role: "ADMIN",
    from: statsParsed.from,
    to: statsParsed.to,
    teacherIds: statsParsed.teacherIds.length > 0 ? statsParsed.teacherIds : undefined,
    methodIds: statsParsed.methodIds.length > 0 ? statsParsed.methodIds : undefined,
    studentType: statsParsed.studentType || undefined,
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
              Recaudación y pagos
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Caja
            </h1>
          </div>
          {paymentStudents.length > 0 && (
            <RegisterPaymentButton students={paymentStudents} size="lg" />
          )}
        </div>
      </div>

      {showRevenue && (
        <RevenuePanel
          filters={statsFilters}
          teachers={teachers}
          gymKind={gymConfig?.kind}
          activeFilters={{
            from: statsParsed.fromStr,
            to: statsParsed.toStr,
            teacherIds: statsParsed.teacherIds,
            methodIds: statsParsed.methodIds,
            studentType: statsParsed.studentType,
          }}
        />
      )}
    </div>
  );
}
