import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { formatMemberNumber } from "@/lib/memberNumber";
import { formatDateArg } from "@/lib/dates";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function IngresosHistorialPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ACCESS" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const logs = await prisma.accessLog.findMany({
    where: { gymId: session.user.gymId },
    orderBy: { at: "desc" },
    take: 200,
    select: {
      id: true,
      at: true,
      state: true,
      decidedAt: true,
      user: {
        select: { id: true, name: true, memberNumber: true },
      },
      decidedBy: {
        select: { name: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Historial de ingresos
        </h1>
        <span className="text-xs font-heading font-bold text-brand-red bg-brand-red/10 px-2 py-0.5">
          {logs.length}
        </span>
        <div className="flex-1 h-px bg-line" aria-hidden="true" />
      </header>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">
          Todavía no hay ingresos registrados.
        </p>
      ) : (
        <div className="border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel">
                {["Fecha", "Hora", "Nº", "Alumno", "Estado", "Decidió"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const at = new Date(log.at);
                const time = at.toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Argentina/Buenos_Aires",
                });
                return (
                  <tr
                    key={log.id}
                    className="border-b border-line hover:bg-hover transition-colors duration-200"
                  >
                    <td className="px-4 py-3 text-gray-400 font-body">
                      {formatDateArg(at)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 tabular-nums font-heading">
                      {time}
                    </td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums font-heading">
                      {formatMemberNumber(log.user.memberNumber)}
                    </td>
                    <td className="px-4 py-3 text-white font-heading font-bold">
                      {log.user.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5",
                          log.state === "GRANTED"
                            ? "bg-green-500/10 text-green-400 border border-green-500/30"
                            : log.state === "DENIED"
                            ? "bg-brand-red/15 text-brand-red border border-brand-red/30"
                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
                        ].join(" ")}
                      >
                        {log.state === "GRANTED"
                          ? "Permitido"
                          : log.state === "DENIED"
                          ? "Denegado"
                          : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-body text-xs">
                      {log.decidedBy?.name ?? (log.state === "GRANTED" ? "Auto" : "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
