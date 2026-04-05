import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { WodManagerClient } from "@/components/wod/WodManagerClient";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function TeacherDashboardPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const teacherId = session.user.id;

  const wods = await prisma.wod.findMany({
    where: { teacherId },
    orderBy: { date: "desc" },
    select: { id: true, content: true, date: true },
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome header */}
      <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-[#E31414] mb-1">
              Dashboard Profe
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Hola, {session.user.name?.split(" ")[0]}
            </h1>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-heading font-black text-[#E31414]">{wods.length}</p>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                {wods.length === 1 ? "WOD" : "WODs"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* WOD manager */}
      <WodManagerClient wods={wods} />
    </div>
  );
}
