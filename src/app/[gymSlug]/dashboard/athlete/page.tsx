import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import { WodCard } from "@/components/wod/WodCard";
import { WodList } from "@/components/wod/WodList";
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

  const teacherLink = await prisma.teacherStudent.findFirst({
    where: { studentId },
  });

  const wodPath = gymPath(gymSlug, "/dashboard/athlete/wod");

  if (!teacherLink) {
    return (
      <div className="flex flex-col gap-10">
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          WOD de Hoy
        </h1>
        <div className="border border-[#2A2A2A] p-8 text-center">
          <p className="text-gray-500 text-sm font-heading font-bold uppercase tracking-[0.15em]">
            No tenes profe asignado
          </p>
          <p className="text-gray-700 text-xs mt-2 font-body">
            Pedile al admin que te asigne un profe.
          </p>
        </div>
      </div>
    );
  }

  const allWods = await prisma.wod.findMany({
    where: { teacherId: teacherLink.teacherId },
    orderBy: { date: "desc" },
    select: { id: true, content: true, date: true },
  });

  const todayWod = allWods.find((w) => toInputDate(w.date) === todayStr) ?? null;
  const historyWods = allWods.filter((w) => toInputDate(w.date) !== todayStr);

  return (
    <div className="flex flex-col gap-10">
      {/* Today's WOD */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
            WOD de Hoy
          </h1>
          {todayWod && (
            <Link
              href={wodPath}
              className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-[#E31414] hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Ver en grande
            </Link>
          )}
        </div>
        {todayWod ? (
          <Link href={wodPath} className="block cursor-pointer group">
            <WodCard wod={todayWod} highlight />
          </Link>
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
        <WodList
          wods={historyWods}
          renderActions={(wod) => (
            <Link
              href={`${wodPath}?id=${wod.id}`}
              className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-[#E31414] transition-colors duration-200 cursor-pointer"
            >
              Ver
            </Link>
          )}
          emptyMessage="No hay WODs anteriores."
        />
      </section>
    </div>
  );
}
