import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { isBookingModuleEnabled } from "@/lib/gym-module-guards";
import { ActivitySlotManager } from "@/components/activity/ActivitySlotManager";
import { ActivitySessionList } from "@/components/activity/ActivitySessionList";
import { SESSION_HORIZON_WEEKS, ensureSessionsForSlot } from "@/lib/activity-schedule";
import { toInputDate } from "@/lib/dates";
import { formatVigencia } from "@/components/activity/format";

interface Props {
  params: Promise<{ gymSlug: string; activityId: string }>;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export default async function ActivityDetailPage({ params }: Props) {
  const { gymSlug, activityId } = await params;
  const session = await auth();

  if (!session?.user) redirect(gymPath(gymSlug, "/login"));
  if (session.user.role !== "ADMIN" && session.user.role !== "TEACHER") {
    redirect(gymPath(gymSlug, session.user.role === "STUDENT" ? "/dashboard/athlete" : "/login"));
  }
  if (!session.user.gymId) redirect(gymPath(gymSlug, "/login"));

  const enabled = await isBookingModuleEnabled(gymSlug);
  if (!enabled) {
    redirect(gymPath(gymSlug, session.user.role === "ADMIN" ? "/admin" : "/dashboard/teacher"));
  }

  const gymId = session.user.gymId;

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, gymId },
    select: {
      id: true,
      name: true,
      description: true,
      active: true,
      teacherId: true,
      teacher: { select: { name: true } },
      scheduleKind: true,
      cancelWindowHours: true,
      startsOn: true,
      endsOn: true,
      slots: { orderBy: [{ dayOfWeek: "asc" }, { date: "asc" }, { startMinute: "asc" }] },
    },
  });
  if (!activity) notFound();

  if (session.user.role === "TEACHER" && activity.teacherId !== session.user.id) {
    redirect(gymPath(gymSlug, "/turnos/gestion"));
  }

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } });
  const timezone = gym?.timezone ?? "America/Argentina/Buenos_Aires";

  // Materialización on-demand: si el cron todavía no corrió, las sesiones de
  // los horarios activos igual aparecen frescas al abrir esta vista (design.md
  // D2, riesgo de desfasaje, y tasks 4.6). `ensureSessionsForSlot` es
  // idempotente — no duplica si el cron ya generó las mismas fechas.
  const horizon = addWeeks(new Date(), SESSION_HORIZON_WEEKS);
  await Promise.all(
    activity.slots.filter((s) => s.active).map((s) => ensureSessionsForSlot(s.id, horizon).catch(() => 0))
  );

  const sessions = await prisma.activitySession.findMany({
    where: { slot: { activityId }, gymId, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    select: { id: true, date: true, startsAt: true, endsAt: true, capacity: true, bookedCount: true, cancelled: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">Actividad</p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          {activity.name}
        </h1>
        {activity.description && <p className="text-sm text-gray-400 font-body mt-2">{activity.description}</p>}
        <p className="text-xs text-gray-500 font-body mt-2">
          Profe: {activity.teacher?.name ?? "Sin asignar"} · Ventana de cancelación: {activity.cancelWindowHours}hs
          {activity.scheduleKind === "WEEKLY" && activity.startsOn && (
            <>
              {" "}
              · Vigencia:{" "}
              {formatVigencia(toInputDate(activity.startsOn), activity.endsOn ? toInputDate(activity.endsOn) : null)}
            </>
          )}
          {!activity.active && <span className="ml-2 text-brand-red">· Desactivada</span>}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">Horarios</h2>
        <ActivitySlotManager
          activityId={activity.id}
          scheduleKind={activity.scheduleKind}
          slots={activity.slots.map((s) => ({
            id: s.id,
            dayOfWeek: s.dayOfWeek,
            date: s.date ? toInputDate(s.date) : null,
            startMinute: s.startMinute,
            endMinute: s.endMinute,
            capacity: s.capacity,
            active: s.active,
          }))}
        />
      </section>

      <section>
        <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
          Próximas sesiones
        </h2>
        <ActivitySessionList
          gymSlug={gymSlug}
          activityId={activity.id}
          timezone={timezone}
          sessions={sessions.map((s) => ({
            id: s.id,
            date: s.date.toISOString(),
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
            capacity: s.capacity,
            bookedCount: s.bookedCount,
            cancelled: s.cancelled,
          }))}
        />
      </section>
    </div>
  );
}
