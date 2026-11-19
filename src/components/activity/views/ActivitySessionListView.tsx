"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { formatDateArg } from "@/lib/dates";
import type { SessionRow, SimpleActionResult } from "./view-models";

type Props = {
  sessions: SessionRow[];
  timezone: string;
  getSessionHref: (sessionId: string) => string;
  /** Optional local navigation for an action-free demo shell. */
  onNavigate?: (sessionId: string) => void;
  onCancel: (sessionId: string) => Promise<SimpleActionResult>;
};
function formatTime(iso: string, timezone: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivitySessionListView({
  sessions: initial,
  timezone,
  getSessionHref,
  onNavigate,
  onCancel,
}: Props) {
  const [sessions, setSessions] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function cancel(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await onCancel(id);
      if (!result.success) setError(result.error);
      else
        setSessions((rows) =>
          rows.map((row) =>
            row.id === id ? { ...row, cancelled: true } : row,
          ),
        );
      setBusyId(null);
    });
  }
  if (!sessions.length)
    return (
      <p className="px-4 py-6 text-sm text-gray-500 font-body italic border border-line">
        Todavía no hay sesiones generadas para este horario. Se generan
        automáticamente.
      </p>
    );
  return (
    <div className="border border-line">
      <ul className="divide-y divide-line">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
          >
            <div>
              <Link
                href={getSessionHref(session.id)}
                onClick={
                  onNavigate
                    ? (event) => {
                        event.preventDefault();
                        onNavigate(session.id);
                      }
                    : undefined
                }
                className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
              >
                {formatDateArg(new Date(session.date))} ·{" "}
                {formatTime(session.startsAt, timezone)}–
                {formatTime(session.endsAt, timezone)}
              </Link>
              <p className="text-gray-500 text-xs font-body">
                {session.capacity === null
                  ? "Sin límite de cupo"
                  : `${session.bookedCount}/${session.capacity} anotados`}
                {session.cancelled && (
                  <span className="ml-2 text-brand-red">· Cancelada</span>
                )}
              </p>
            </div>
            {!session.cancelled && (
              <Button
                variant="danger"
                size="sm"
                loading={isPending && busyId === session.id}
                onClick={() => cancel(session.id)}
              >
                Cancelar sesión
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p
          className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
