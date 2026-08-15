"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cancelActivitySession } from "@/actions/activity";
import { gymPath } from "@/lib/gym";
import { formatDateArg } from "@/lib/dates";

export interface SessionRow {
  id: string;
  date: string; // ISO (@db.Date)
  startsAt: string; // ISO
  endsAt: string; // ISO
  capacity: number | null;
  bookedCount: number;
  cancelled: boolean;
}

interface Props {
  gymSlug: string;
  activityId: string;
  sessions: SessionRow[];
  /** Gym.timezone — las sesiones se muestran en la hora local del gym, no en UTC del server. */
  timezone: string;
}

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
}

export function ActivitySessionList({ gymSlug, activityId, sessions: initial, timezone }: Props) {
  const [sessions, setSessions] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await cancelActivitySession(id);
      if (!result.success) {
        setError(result.error);
      } else {
        setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, cancelled: true } : s)));
      }
      setBusyId(null);
    });
  }

  if (sessions.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-500 font-body italic border border-line">
        Todavía no hay sesiones generadas para este horario. Se generan automáticamente.
      </p>
    );
  }

  return (
    <div className="border border-line">
      <ul className="divide-y divide-line">
        {sessions.map((s) => (
          <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Link
                href={gymPath(gymSlug, `/turnos/gestion/${activityId}/sesiones/${s.id}`)}
                className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
              >
                {formatDateArg(new Date(s.date))} · {formatTime(s.startsAt, timezone)}–{formatTime(s.endsAt, timezone)}
              </Link>
              <p className="text-gray-500 text-xs font-body">
                {s.capacity === null ? "Sin límite de cupo" : `${s.bookedCount}/${s.capacity} anotados`}
                {s.cancelled && <span className="ml-2 text-brand-red">· Cancelada</span>}
              </p>
            </div>
            {!s.cancelled && (
              <Button
                variant="danger"
                size="sm"
                loading={isPending && busyId === s.id}
                onClick={() => handleCancel(s.id)}
              >
                Cancelar sesión
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
