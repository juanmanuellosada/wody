import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import { WodCard } from "@/components/wod/WodCard";
import { WodHistory } from "@/components/wod/WodHistory";
import { gymPath } from "@/lib/gym";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function StudentDashboardPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "STUDENT") {
    redirect(gymPath(gymSlug, "/login"));
  }

  const studentId = session.user.id;
  const todayStr = toInputDate(getTodayArgentina());

  const teacherLinks = await prisma.teacherStudent.findMany({
    where: { studentId },
    select: { teacherId: true },
  });
  const teacherIds = teacherLinks.map((l) => l.teacherId);

  const wodPath = gymPath(gymSlug, "/dashboard/athlete/wod");

  // Students without a teacher: show blurred paywall
  if (teacherIds.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        <div className="relative">
          <div className="blur-md pointer-events-none select-none" aria-hidden="true">
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white mb-5">
              WOD de Hoy
            </h1>
            <div className="border border-[#2A2A2A] bg-[#1A1A1A] p-6">
              <p className="text-white font-heading font-bold uppercase text-sm">WARM UP</p>
              <p className="text-gray-400 text-sm mt-2">3 rondas — Movilidad general</p>
              <p className="text-gray-400 text-sm">5 cossack squat / 5 ohs con disco</p>
              <p className="text-white font-heading font-bold uppercase text-sm mt-4">OLY</p>
              <p className="text-gray-400 text-sm mt-2">Clean — 1 rep — 50/55/60/65/70%</p>
              <p className="text-white font-heading font-bold uppercase text-sm mt-4">AMRAP 12&apos;</p>
              <p className="text-gray-400 text-sm mt-2">T2B / BBJO / Power Clean 60%</p>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/80 border border-brand-red/30 p-8 text-center max-w-sm mx-4">
              <p className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white mb-3">
                Contenido exclusivo
              </p>
              <p className="text-sm text-gray-400 font-body mb-4 leading-relaxed">
                Los WODs personalizados son para alumnos del plan personalizado.
                Habla con tu profe para acceder.
              </p>
              <Link
                href={gymPath(gymSlug, "/dashboard/rms")}
                className="inline-block px-6 py-3 font-heading font-bold uppercase tracking-[0.15em] text-white text-xs bg-brand-red hover:bg-brand-red-dark transition-colors duration-200"
              >
                Ir a mis RMs
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { groupId: true, studentType: true },
  });

  const isPersonalized = student?.studentType === "PERSONALIZED";

  const allWods = await prisma.wod.findMany({
    where: {
      teacherId: { in: teacherIds },
      OR: [
        { targetType: "ALL" },
        ...(isPersonalized
          ? [
              { targetType: "PERSONALIZED" as const },
              ...(student?.groupId
                ? [{ targetType: "GROUP" as const, targetGroupId: student.groupId }]
                : []),
              { targetType: "STUDENT" as const, targetStudentId: studentId },
            ]
          : []),
      ],
    },
    orderBy: { date: "desc" },
    select: { id: true, title: true, content: true, date: true },
  });

  const todayWods = allWods.filter((w) => toInputDate(w.date) === todayStr);
  const historyWods = allWods.filter((w) => toInputDate(w.date) !== todayStr);

  return (
    <div className="flex flex-col gap-10">
      {/* Today's WODs */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
            {todayWods.length > 1 ? "WODs de Hoy" : "WOD de Hoy"}
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
                <WodCard wod={wod} highlight />
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-[#2A2A2A] p-8 text-center">
            <p className="text-gray-500 text-sm font-heading font-bold uppercase tracking-[0.15em]">
              No hay WOD para hoy
            </p>
            <p className="text-gray-700 text-xs mt-2 font-body">
              Habla con tu profe
            </p>
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Historial
          </h2>
          <div className="flex-1 h-px bg-[#1A1A1A]" aria-hidden="true" />
        </div>
        <WodHistory wods={historyWods} wodPath={wodPath} />
      </section>
    </div>
  );
}
