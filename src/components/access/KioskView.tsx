"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  decideCheckin,
  lookupForKiosk,
  createManualCheckin,
  type LookupUser,
} from "@/actions/access";
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

        <ManualLookup />
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

function ManualLookup() {
  const [input, setInput] = useState("");
  const [looked, setLooked] = useState<LookupUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justGranted, setJustGranted] = useState<LookupUser | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJustGranted(null);
    const trimmed = input.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await lookupForKiosk(trimmed);
      if (!res.success) {
        setError(res.error);
        setLooked(null);
        return;
      }
      if (res.alDia) {
        // Al día → auto-permit, igual que el flujo de QR. Sin paso
        // intermedio de decisión.
        const grantRes = await createManualCheckin(res.user.id, "GRANT");
        if (!grantRes.success) {
          setError(grantRes.error);
          setLooked(null);
          return;
        }
        setJustGranted(res.user);
        setInput("");
        setTimeout(() => setJustGranted(null), 2500);
      } else {
        setLooked(res.user);
      }
    });
  }

  function handleDecide(decision: "GRANT" | "DENY") {
    if (!looked) return;
    setError(null);
    startTransition(async () => {
      const res = await createManualCheckin(looked.id, decision);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setLooked(null);
      setInput("");
    });
  }

  function handleCancel() {
    setLooked(null);
    setInput("");
    setError(null);
  }

  if (looked) {
    return (
      <ManualLookupCard
        user={looked}
        isPending={isPending}
        error={error}
        onGrant={() => handleDecide("GRANT")}
        onDeny={() => handleDecide("DENY")}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <form onSubmit={handleSearch} className="flex flex-col gap-2 mt-4">
      <label className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-500">
        Ingreso manual
      </label>
      <p className="text-xs text-gray-600 font-body">
        Si el alumno no puede escanear, buscalo por nº de socio o email.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0042 o email@..."
          disabled={isPending}
          className="flex-1 bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={isPending}
          disabled={!input.trim() || isPending}
        >
          Buscar
        </Button>
      </div>
      {error && (
        <p
          className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
          role="alert"
        >
          {error}
        </p>
      )}
      {justGranted && (
        <div
          className="border border-green-500/40 bg-green-500/10 px-3 py-2"
          role="status"
        >
          <p className="text-xs font-heading font-bold text-green-400 uppercase tracking-wide">
            Permitido · {formatMemberNumber(justGranted.memberNumber)}{" "}
            {justGranted.name}
          </p>
        </div>
      )}
    </form>
  );
}

function ManualLookupCard({
  user,
  isPending,
  error,
  onGrant,
  onDeny,
  onCancel,
}: {
  user: LookupUser;
  isPending: boolean;
  error: string | null;
  onGrant: () => void;
  onDeny: () => void;
  onCancel: () => void;
}) {
  const today = getTodayArgentina();
  const dueDate = new Date(user.nextPaymentDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((dueDate.getTime() - today.getTime()) / msPerDay);
  const blocked = user.blockedAt !== null;
  const alDia = !blocked && daysDiff >= 0;

  const statusLabel = blocked
    ? "Bloqueado"
    : daysDiff < 0
    ? `Atrasado ${-daysDiff} ${-daysDiff === 1 ? "día" : "días"}`
    : daysDiff === 0
    ? "Vence hoy"
    : `Al día`;

  const statusClasses = blocked
    ? "bg-brand-red/20 text-brand-red border border-brand-red/40"
    : alDia
    ? "bg-green-500/10 text-green-400 border border-green-500/30"
    : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";

  const roleLabel: Record<string, string> = {
    ADMIN: "Admin",
    TEACHER: "Profe",
    STUDENT: "Alumno",
    ACCESS: "Accesos",
  };

  return (
    <div className="border border-brand-red/30 bg-brand-red/5 p-4 flex flex-col gap-3 mt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-heading font-bold text-base truncate">
            <span className="text-gray-500 mr-2 tabular-nums tracking-[0.1em]">
              {formatMemberNumber(user.memberNumber)}
            </span>
            {user.name}
          </p>
          <p className="text-xs text-gray-500 font-body mt-0.5">
            {roleLabel[user.role]} · Próximo pago {formatDateArg(dueDate)}
          </p>
        </div>
        <span
          className={[
            "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 flex-shrink-0",
            statusClasses,
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
      <div className="flex gap-2 justify-end items-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white px-2 min-h-[36px] disabled:opacity-50"
        >
          Cancelar
        </button>
        <Button
          variant="danger"
          size="sm"
          onClick={onDeny}
          disabled={isPending}
        >
          Denegar
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onGrant}
          loading={isPending}
        >
          Permitir
        </Button>
      </div>
    </div>
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
