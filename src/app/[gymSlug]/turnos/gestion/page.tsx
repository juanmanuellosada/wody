import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { isBookingModuleEnabled } from "@/lib/gym-module-guards";
import { ActivityList } from "@/components/activity/ActivityList";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function TurnosGestionPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user) redirect(gymPath(gymSlug, "/login"));
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    redirect(gymPath(gymSlug, session.user.role === "STUDENT" ? "/dashboard/athlete" : "/login"));
  }
  if (!session.user.gymId) redirect(gymPath(gymSlug, "/login"));

  // Revalida bookingEnabled fresco de DB: el acceso por URL directa se
  // rechaza aunque el token de sesión esté stale (patrón de
  // src/app/[gymSlug]/productos/page.tsx:31-38).
  const enabled = await isBookingModuleEnabled(gymSlug);
  if (!enabled) {
    redirect(gymPath(gymSlug, session.user.role === "ADMIN" ? "/admin" : "/dashboard/teacher"));
  }

  const gymId = session.user.gymId;
  const isAdmin = session.user.role === "ADMIN";

  const [activities, teachers] = await Promise.all([
    prisma.activity.findMany({
      // active: true — una actividad archivada (eliminada con historial, ver
      // deleteActivity) desaparece de todas las listas de gestión.
      where: isAdmin ? { gymId, active: true } : { gymId, teacherId: session.user.id, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        teacherId: true,
        allowsRecurring: true,
        cancelWindowHours: true,
        capacity: true,
        active: true,
        teacher: { select: { name: true } },
      },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: { gymId, role: "TEACHER", deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const activityRows = activities.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    color: a.color,
    teacherId: a.teacherId,
    teacherName: a.teacher?.name ?? null,
    allowsRecurring: a.allowsRecurring,
    cancelWindowHours: a.cancelWindowHours,
    capacity: a.capacity,
    active: a.active,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">Turnos</p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Gestión de actividades
        </h1>
      </div>

      <ActivityList gymSlug={gymSlug} activities={activityRows} teachers={teachers} canAssignTeacher={isAdmin} />
    </div>
  );
}
