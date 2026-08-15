import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { ReminderLeadHoursForm } from "./ReminderLeadHoursForm";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function AjustesPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(gymPath(gymSlug, "/login"));
  }

  if (!session.user.gymId) {
    redirect(gymPath(gymSlug, "/login"));
  }

  // Relee bookingEnabled fresco desde la DB (no confiar en el token, que
  // puede quedar stale) — mismo patrón que productos/page.tsx.
  const gym = await prisma.gym.findUnique({
    where: { id: session.user.gymId },
    select: { bookingEnabled: true, reminderLeadHours: true },
  });

  if (!gym?.bookingEnabled) {
    redirect(gymPath(gymSlug, "/admin"));
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Configuración
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Ajustes de turnos
        </h1>
      </div>

      <div className="border border-line bg-panel p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white mb-1">
            Recordatorio de turno
          </h2>
          <p className="text-xs text-gray-500 font-body">
            Con cuántas horas de anticipación se les avisa a los alumnos, por push, que su turno está por empezar.
          </p>
        </div>
        <ReminderLeadHoursForm currentHours={gym.reminderLeadHours} />
      </div>

      <div className="border-t border-line pt-4">
        <Link
          href={gymPath(gymSlug, "/admin")}
          className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white transition-colors duration-200"
        >
          ← Volver al panel
        </Link>
      </div>
    </div>
  );
}
