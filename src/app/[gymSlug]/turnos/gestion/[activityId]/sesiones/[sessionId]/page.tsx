import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { isBookingModuleEnabled } from "@/lib/gym-module-guards";
import { formatDateArg } from "@/lib/dates";
import { SessionEnrollmentManager } from "@/components/activity/SessionEnrollmentManager";

interface Props {
  params: Promise<{ gymSlug: string; activityId: string; sessionId: string }>;
}

function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("es-AR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
}

export default async function ActivitySessionPage({ params }: Props) {
  const { gymSlug, activityId, sessionId } = await params;
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

  const activitySession = await prisma.activitySession.findFirst({
    where: { id: sessionId, gymId, slot: { activityId } },
    select: {
      id: true,
      date: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      bookedCount: true,
      cancelled: true,
      slot: { select: { activity: { select: { id: true, name: true, teacherId: true } } } },
    },
  });
  if (!activitySession) notFound();

  if (session.user.role === "TEACHER" && activitySession.slot.activity.teacherId !== session.user.id) {
    redirect(gymPath(gymSlug, "/turnos/gestion"));
  }

  const [gym, bookings, students] = await Promise.all([
    prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } }),
    prisma.activityBooking.findMany({
      where: { sessionId, status: "CONFIRMED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, createdById: true, user: { select: { name: true, accountKind: true } } },
    }),
    prisma.user.findMany({
      where: { gymId, role: "STUDENT", deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, accountKind: true },
    }),
  ]);
  const timezone = gym?.timezone ?? "America/Argentina/Buenos_Aires";

  const bookedUserIds = new Set(bookings.map((b) => b.userId));
  const availableStudents = students.filter((s) => !bookedUserIds.has(s.id));

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          {activitySession.slot.activity.name}
        </p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          {formatDateArg(activitySession.date)} · {formatTime(activitySession.startsAt, timezone)}–
          {formatTime(activitySession.endsAt, timezone)}
        </h1>
        <p className="text-xs text-gray-500 font-body mt-2">
          {activitySession.capacity === null
            ? "Sin límite de cupo"
            : `${activitySession.bookedCount}/${activitySession.capacity} anotados`}
          {activitySession.cancelled && <span className="ml-2 text-brand-red">· Sesión cancelada</span>}
        </p>
      </div>

      <SessionEnrollmentManager
        sessionId={activitySession.id}
        cancelled={activitySession.cancelled}
        bookings={bookings.map((b) => ({
          bookingId: b.id,
          userId: b.userId,
          name: b.user.name,
          accountKind: b.user.accountKind,
          addedByStaff: b.createdById !== null,
        }))}
        availableStudents={availableStudents.map((s) => ({ id: s.id, name: s.name, accountKind: s.accountKind }))}
      />
    </div>
  );
}
