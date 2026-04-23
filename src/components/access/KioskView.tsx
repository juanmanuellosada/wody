"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { decideCheckin } from "@/actions/access";
import { formatMemberNumber } from "@/lib/memberNumber";
import { formatDateArg, getTodayArgentina } from "@/lib/dates";

interface PendingUser {
  id: string;
  name: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "ACCESS";
  memberNumber: number;
  nextPaymentDate: string;
  blockedAt: string | null;
}

interface PendingLog {
  id: string;
  at: string;
  user: PendingUser;
}

interface RecentLog {
  id: string;
  at: string;
  state: "GRANTED" | "DENIED";
  decidedAt: string | null;
  user: { id: string; name: string; memberNumber: number };
}

interface KioskViewProps {
  gymSlug: string;
  initialQrSvg: string;
  initialQrExpiresInMs: number;
}

export function KioskView({
  gymSlug,
  initialQrSvg,
  initialQrExpiresInMs,
}: KioskViewProps) {
  const router = useRouter();
  const [qrSvg, setQrSvg] = useState(initialQrSvg);
  const [pending, setPending] = useState<PendingLog[]>([]);
  const [recent, setRecent] = useState<RecentLog[]>([]);

  // Refresca el QR cuando el bucket cambia. Pedimos un re-render del
  // server component con router.refresh() y leemos el nuevo SVG via
  // props en el próximo render.
  useEffect(() => {
    const timer = setTimeout(
      () => router.refresh(),
      initialQrExpiresInMs + 100
    );
    return () => clearTimeout(timer);
  }, [initialQrExpiresInMs, router]);

  useEffect(() => {
    setQrSvg(initialQrSvg);
  }, [initialQrSvg]);

  // Polling del feed cada 2s.
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/ingresos/pending", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          pending: PendingLog[];
          recent: RecentLog[];
        };
        if (cancelled) return;
        setPending(data.pending);
        setRecent(data.recent);
      } catch {
        /* ignore transient errors */
      }
    }

    tick();
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gymSlug]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Panel izq: QR */}
      <section className="lg:w-[340px] flex flex-col gap-3">
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Ingresos
        </h1>
        <p className="text-xs font-body text-gray-500">
          Los alumnos escanean este QR con su celular para registrar su
          ingreso. El código rota cada 5 minutos.
        </p>
        <div
          className="bg-white p-4 self-start"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
          aria-label="QR para check-in"
        />
      </section>

      {/* Panel der: pendings + recientes */}
      <section className="flex-1 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              Pendientes
            </h2>
            {pending.length > 0 && (
              <span className="text-xs font-heading font-bold text-brand-red bg-brand-red/10 px-2 py-0.5">
                {pending.length}
              </span>
            )}
            <div className="flex-1 h-px bg-line" aria-hidden="true" />
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-gray-500 font-body italic">
              No hay ingresos pendientes.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {pending.map((log) => (
                <PendingCard key={log.id} log={log} />
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Recientes
            </h2>
            <div className="flex-1 h-px bg-line" aria-hidden="true" />
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-600 font-body italic">
              Todavía no hay ingresos hoy.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line border border-line">
              {recent.map((log) => (
                <RecentRow key={log.id} log={log} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function PendingCard({ log }: { log: PendingLog }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = getTodayArgentina();
  const dueDate = new Date(log.user.nextPaymentDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (dueDate.getTime() - today.getTime()) / msPerDay
  );
  const statusLabel = log.user.blockedAt
    ? "Bloqueado"
    : daysDiff < 0
    ? `Atrasado ${-daysDiff} ${-daysDiff === 1 ? "día" : "días"}`
    : daysDiff === 0
    ? "Vence hoy"
    : `Vence en ${daysDiff} días`;

  function decide(decision: "GRANT" | "DENY") {
    setError(null);
    startTransition(async () => {
      const res = await decideCheckin(log.id, decision);
      if (!res.success) setError(res.error);
    });
  }

  const roleLabel: Record<string, string> = {
    ADMIN: "Admin",
    TEACHER: "Profe",
    STUDENT: "Alumno",
    ACCESS: "Accesos",
  };

  return (
    <li className="border border-brand-red/30 bg-brand-red/5 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-heading font-bold text-base truncate">
            <span className="text-gray-500 mr-2 tabular-nums tracking-[0.1em]">
              {formatMemberNumber(log.user.memberNumber)}
            </span>
            {log.user.name}
          </p>
          <p className="text-xs text-gray-500 font-body mt-0.5">
            {roleLabel[log.user.role]} · Próximo pago {formatDateArg(dueDate)}
          </p>
        </div>
        <span
          className={[
            "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 flex-shrink-0",
            log.user.blockedAt
              ? "bg-brand-red/20 text-brand-red border border-brand-red/40"
              : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30",
          ].join(" ")}
        >
          {statusLabel}
        </span>
      </div>
      {error && (
        <p
          className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button
          variant="danger"
          size="sm"
          onClick={() => decide("DENY")}
          disabled={isPending}
        >
          Denegar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => decide("GRANT")}
          loading={isPending}
        >
          Permitir
        </Button>
      </div>
    </li>
  );
}

function RecentRow({ log }: { log: RecentLog }) {
  const time = new Date(log.at).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      <span
        className={[
          "w-2 h-2 flex-shrink-0",
          log.state === "GRANTED" ? "bg-green-500" : "bg-brand-red",
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="text-gray-500 tabular-nums text-xs w-12">{time}</span>
      <span className="text-gray-500 tabular-nums text-xs tracking-[0.1em]">
        {formatMemberNumber(log.user.memberNumber)}
      </span>
      <span className="text-white font-heading font-bold truncate flex-1">
        {log.user.name}
      </span>
      <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 flex-shrink-0">
        {log.state === "GRANTED" ? "Permitido" : "Denegado"}
      </span>
    </li>
  );
}
