"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { formatMemberNumber } from "@/lib/memberNumber";
import { formatDateArg, getTodayArgentina } from "@/lib/dates";
import type {
  AccessDecision,
  AccessKioskViewProps,
  AccessLookupUser,
  AccessPendingLog,
  AccessRecentLog,
} from "./access-view-contracts";

const roleLabel: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Profe",
  STUDENT: "Alumno",
  ACCESS: "Accesos",
  SUPERADMIN: "Super admin",
};

export function AccessKioskView({
  qrSlot,
  qrDescription,
  pending,
  recent,
  toast,
  selectedDate,
  todayStr,
  isToday,
  onSelectedDateChange,
  onDecideCheckin,
  onLookupForKiosk,
  onCreateManualCheckin,
}: AccessKioskViewProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <section className="lg:w-[340px] flex flex-col gap-3">
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Ingresos
        </h1>
        <p className="text-xs font-body text-gray-500">{qrDescription}</p>
        {qrSlot}
        <ManualLookup
          onLookupForKiosk={onLookupForKiosk}
          onCreateManualCheckin={onCreateManualCheckin}
        />
      </section>

      <section className="flex-1 flex flex-col gap-6">
        {toast && <AccessToast log={toast} />}
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
                <PendingCard
                  key={log.id}
                  log={log}
                  onDecideCheckin={onDecideCheckin}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Ingresos
            </h2>
            {recent.length > 0 && (
              <span className="text-xs font-heading font-bold text-gray-400 bg-elev border border-edge px-2 py-0.5">
                {recent.length}
              </span>
            )}
            <div className="flex-1 h-px bg-line" aria-hidden="true" />
            {!isToday && (
              <button
                type="button"
                onClick={() => onSelectedDateChange(todayStr)}
                className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white px-2 py-1"
              >
                Hoy
              </button>
            )}
            <div className="w-[180px]">
              <DatePicker
                value={selectedDate}
                onChange={onSelectedDateChange}
              />
            </div>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-600 font-body italic">
              {isToday
                ? "Todavía no hay ingresos hoy."
                : `No hubo ingresos el ${formatDateArg(new Date(selectedDate + "T12:00:00Z"))}.`}
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

function AccessToast({ log }: { log: AccessRecentLog }) {
  return (
    <div
      className={[
        "border px-4 py-3 flex items-center gap-3",
        log.state === "GRANTED"
          ? "border-green-500/40 bg-green-500/10"
          : "border-brand-red/40 bg-brand-red/10",
      ].join(" ")}
      role="status"
    >
      <span
        className={[
          "w-2 h-2 flex-shrink-0",
          log.state === "GRANTED" ? "bg-green-500" : "bg-brand-red",
        ].join(" ")}
        aria-hidden="true"
      />
      <p
        className={[
          "text-xs font-heading font-bold uppercase tracking-[0.15em]",
          log.state === "GRANTED" ? "text-green-400" : "text-brand-red",
        ].join(" ")}
      >
        {log.state === "GRANTED" ? "Ingresó" : "Denegado"} ·{" "}
        {formatMemberNumber(log.user.memberNumber)} {log.user.name}
      </p>
    </div>
  );
}

function PendingCard({
  log,
  onDecideCheckin,
}: {
  log: AccessPendingLog;
  onDecideCheckin: AccessKioskViewProps["onDecideCheckin"];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = getTodayArgentina();
  const dueDate = new Date(log.user.nextPaymentDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (dueDate.getTime() - today.getTime()) / msPerDay,
  );
  const statusLabel = log.user.blockedAt
    ? "Bloqueado"
    : daysDiff < 0
      ? `Atrasado ${-daysDiff} ${-daysDiff === 1 ? "día" : "días"}`
      : daysDiff === 0
        ? "Vence hoy"
        : `Vence en ${daysDiff} días`;

  function decide(decision: AccessDecision) {
    setError(null);
    startTransition(async () => {
      const res = await onDecideCheckin(log.id, decision);
      if (!res.success) setError(res.error);
    });
  }

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
      {error && <AccessError error={error} />}
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

function ManualLookup({
  onLookupForKiosk,
  onCreateManualCheckin,
}: Pick<
  AccessKioskViewProps,
  "onLookupForKiosk" | "onCreateManualCheckin"
>) {
  const [input, setInput] = useState("");
  const [looked, setLooked] = useState<AccessLookupUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await onLookupForKiosk(trimmed);
      if (!res.success) {
        setError(res.error);
        setLooked(null);
        return;
      }
      if (res.alDia) {
        const grantRes = await onCreateManualCheckin(res.user.id, "GRANT");
        if (!grantRes.success) {
          setError(grantRes.error);
          setLooked(null);
          return;
        }
        setInput("");
      } else {
        setLooked(res.user);
      }
    });
  }

  function handleDecide(decision: AccessDecision) {
    if (!looked) return;
    setError(null);
    startTransition(async () => {
      const res = await onCreateManualCheckin(looked.id, decision);
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
        Si el socio no puede escanear, buscalo por nº o email.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
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
      {error && <AccessError error={error} />}
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
  user: AccessLookupUser;
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
        : "Al día";

  const statusClasses = blocked
    ? "bg-brand-red/20 text-brand-red border border-brand-red/40"
    : alDia
      ? "bg-green-500/10 text-green-400 border border-green-500/30"
      : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";

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
      {error && <AccessError error={error} />}
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
        <Button variant="primary" size="sm" onClick={onGrant} loading={isPending}>
          Permitir
        </Button>
      </div>
    </div>
  );
}

function AccessError({ error }: { error: string }) {
  return (
    <p
      className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
      role="alert"
    >
      {error}
    </p>
  );
}

function RecentRow({ log }: { log: AccessRecentLog }) {
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
