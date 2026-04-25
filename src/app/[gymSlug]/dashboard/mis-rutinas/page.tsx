import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";
import { WodManagerClient } from "@/components/wod/WodManagerClient";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function MyRoutinesPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(gymPath(gymSlug, "/login"));
  }

  if (!session.user.canCreateOwnRoutines) {
    // Sin la capacidad, mando al dashboard que le corresponda.
    const fallback =
      session.user.role === "STUDENT" ? "/dashboard/athlete" : "/dashboard/teacher";
    redirect(gymPath(gymSlug, fallback));
  }

  const userId = session.user.id;

  const [wods, gym] = await Promise.all([
    prisma.wod.findMany({
      where: {
        teacherId: userId,
        targetType: "STUDENT",
        targetStudentId: userId,
        deletedAt: null,
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        date: true,
        targetType: true,
        targetGroupId: true,
        targetStudentId: true,
      },
    }),
    prisma.gym.findUnique({ where: { slug: gymSlug }, select: { kind: true } }),
  ]);
  const terms = gymTerms(gym?.kind ?? "BOX");

  const wodsForClient = wods.map((w) => ({
    ...w,
    targetGroupName: null,
    targetStudentName: null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Mis rutinas
        </p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          {session.user.name?.split(" ")[0] ?? "Hola"}
        </h1>
        <p className="text-sm text-gray-500 font-body mt-2 leading-relaxed">
          Acá podés crear y editar {terms.wods} solo para vos. Los que cargues
          quedan asignados a tu usuario.
        </p>
      </div>

      <WodManagerClient
        wods={wodsForClient}
        groups={[]}
        students={[]}
        terms={terms}
        lockedTarget={{ type: "STUDENT", studentId: userId }}
      />
    </div>
  );
}
