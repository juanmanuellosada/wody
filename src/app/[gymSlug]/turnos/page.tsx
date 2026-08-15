import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { isBookingModuleEnabled } from "@/lib/gym-module-guards";
import { SESSION_HORIZON_WEEKS, ensureSessionsForSlot } from "@/lib/activity-schedule";
import { TurnosTabs } from "@/components/activity/TurnosTabs";
import { TurnosCalendar } from "@/components/activity/TurnosCalendar";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export default async function TurnosPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user) redirect(gymPath(gymSlug, "/login"));
  if (session.user.role !== "STUDENT") {
    redirect(
      gymPath(
        gymSlug,
        session.user.role === "ADMIN" || session.user.role === "TEACHER" ? "/turnos/gestion" : "/dashboard/athlete"
      )
    );
  }
  if (!session.user.gymId) redirect(gymPath(gymSlug, "/login"));

  // Revalida bookingEnabled fresco de DB: el acceso por URL directa se
  // rechaza aunque el token de sesión esté stale (patrón de
  // src/app/[gymSlug]/productos/page.tsx:31-38).
  const enabled = await isBookingModuleEnabled(gymSlug);
  if (!enabled) redirect(gymPath(gymSlug, "/dashboard/athlete"));

  const gymId = session.user.gymId;
  const userId = session.user.id;

  const [user, gym] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, gymId, deletedAt: null }, select: { accountKind: true } }),
    prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } }),
  ]);
  // Cuentas LITE no pueden auto-reservar: no se expone la acción (spec).
  const canBook = user?.accountKind !== "LITE";
  const timezone = gym?.timezone ?? "America/Argentina/Buenos_Aires";

  const activities = await prisma.activity.findMany({
    where: { gymId, active: true },
    select: { id: true, slots: { where: { active: true }, select: { id: true } } },
  });
  const activeSlotIds = activities.flatMap((a) => a.slots.map((s) => s.id));

  // Materialización on-demand (mismo patrón que turnos/gestion/[activityId]/page.tsx):
  // si el cron todavía no corrió, igual aparecen frescas (design.md D2, tasks 4.6).
  const horizon = addWeeks(new Date(), SESSION_HORIZON_WEEKS);
  await Promise.all(activeSlotIds.map((id) => ensureSessionsForSlot(id, horizon).catch(() => 0)));

  const sessions = await prisma.activitySession.findMany({
    where: { gymId, startsAt: { gte: new Date() }, slot: { active: true, activity: { active: true } } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      slotId: true,
      date: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      bookedCount: true,
      cancelled: true,
      slot: {
        select: {
          dayOfWeek: true,
          activity: { select: { name: true, allowsRecurring: true } },
        },
      },
    },
  });

  const sessionIds = sessions.map((s) => s.id);
  const [myBookings, myEnrollments] = await Promise.all([
    prisma.activityBooking.findMany({
      where: { userId, gymId, sessionId: { in: sessionIds }, status: "CONFIRMED" },
      select: { id: true, sessionId: true },
    }),
    prisma.activityEnrollment.findMany({
      where: { userId, gymId, cancelledAt: null },
      select: { slotId: true },
    }),
  ]);
  const bookingBySession = new Map(myBookings.map((b) => [b.sessionId, b.id]));
  const enrolledSlotIds = new Set(myEnrollments.map((e) => e.slotId));

  const sessionRows = sessions.map((s) => ({
    id: s.id,
    slotId: s.slotId,
    dayOfWeek: s.slot.dayOfWeek,
    activityName: s.slot.activity.name,
    allowsRecurring: s.slot.activity.allowsRecurring,
    date: s.date.toISOString(),
    startsAt: s.startsAt.toISOString(),
    endsAt: s.endsAt.toISOString(),
    capacity: s.capacity,
    bookedCount: s.bookedCount,
    cancelled: s.cancelled,
    bookingId: bookingBySession.get(s.id) ?? null,
    enrolledSlot: enrolledSlotIds.has(s.slotId),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">Turnos</p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Calendario de actividades
        </h1>
      </div>

      <TurnosTabs gymSlug={gymSlug} active="calendario" />

      {activities.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic border border-line">
          Todavía no hay actividades configuradas en este gym.
        </p>
      ) : activeSlotIds.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic border border-line">
          Las actividades de este gym todavía no tienen horarios activos.
        </p>
      ) : (
        <TurnosCalendar timezone={timezone} sessions={sessionRows} canBook={canBook} />
      )}
    </div>
  );
}
