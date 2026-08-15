import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { isBookingModuleEnabled } from "@/lib/gym-module-guards";
import { TurnosTabs } from "@/components/activity/TurnosTabs";
import { MyTurnos } from "@/components/activity/MyTurnos";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function MisTurnosPage({ params }: Props) {
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

  const enabled = await isBookingModuleEnabled(gymSlug);
  if (!enabled) redirect(gymPath(gymSlug, "/dashboard/athlete"));

  const gymId = session.user.gymId;
  const userId = session.user.id;

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } });
  const timezone = gym?.timezone ?? "America/Argentina/Buenos_Aires";

  const [bookings, enrollments] = await Promise.all([
    prisma.activityBooking.findMany({
      where: { userId, gymId, status: "CONFIRMED", session: { cancelled: false, startsAt: { gte: new Date() } } },
      select: {
        id: true,
        session: {
          select: {
            date: true,
            startsAt: true,
            endsAt: true,
            slot: { select: { activity: { select: { name: true, color: true } } } },
          },
        },
      },
    }),
    prisma.activityEnrollment.findMany({
      where: { userId, gymId, cancelledAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        slot: {
          select: {
            dayOfWeek: true,
            startMinute: true,
            endMinute: true,
            activity: { select: { name: true, color: true } },
          },
        },
      },
    }),
  ]);

  const bookingRows = bookings
    .map((b) => ({
      bookingId: b.id,
      activityName: b.session.slot.activity.name,
      activityColor: b.session.slot.activity.color,
      date: b.session.date.toISOString(),
      startsAt: b.session.startsAt.toISOString(),
      endsAt: b.session.endsAt.toISOString(),
    }))
    .sort((a, c) => a.startsAt.localeCompare(c.startsAt));

  const enrollmentRows = enrollments.map((e) => ({
    enrollmentId: e.id,
    activityName: e.slot.activity.name,
    activityColor: e.slot.activity.color,
    dayOfWeek: e.slot.dayOfWeek,
    startMinute: e.slot.startMinute,
    endMinute: e.slot.endMinute,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">Turnos</p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Mis turnos
        </h1>
      </div>

      <TurnosTabs gymSlug={gymSlug} active="mis-turnos" />

      <MyTurnos timezone={timezone} bookings={bookingRows} enrollments={enrollmentRows} />
    </div>
  );
}
