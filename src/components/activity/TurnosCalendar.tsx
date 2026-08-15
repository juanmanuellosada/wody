"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RecurringChoiceDialog } from "@/components/activity/RecurringChoiceDialog";
import { bookSingleSession, enrollInSlot, cancelBooking } from "@/actions/booking";
import { formatDateArg } from "@/lib/dates";
import { DAY_NAMES } from "@/components/activity/format";

export interface StudentSessionRow {
  id: string;
  slotId: string;
  /** null en actividades ONE_OFF (sin día de la semana fijo). */
  dayOfWeek: number | null;
  activityName: string;
  allowsRecurring: boolean;
  date: string; // ISO (@db.Date)
  startsAt: string; // ISO
  endsAt: string; // ISO
  capacity: number | null;
  bookedCount: number;
  cancelled: boolean;
  bookingId: string | null;
  enrolledSlot: boolean;
}

interface Props {
  timezone: string;
  sessions: StudentSessionRow[];
  /** false para cuentas LITE: no se expone la acción de reservar. */
  canBook: boolean;
}

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
}

export function TurnosCalendar({ timezone, sessions: initial, canBook }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [choiceRow, setChoiceRow] = useState<StudentSessionRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function bookSingle(row: StudentSessionRow) {
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      const result = await bookSingleSession(row.id);
      if (!result.success) {
        setError(result.error);
        setBusyId(null);
        return;
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, bookingId: result.bookingId, bookedCount: s.bookedCount + 1 } : s))
      );
      setChoiceRow(null);
      setBusyId(null);
    });
  }

  function enrollAll(row: StudentSessionRow) {
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      const result = await enrollInSlot(row.slotId);
      if (!result.success) {
        setError(result.error);
        setBusyId(null);
        return;
      }
      setChoiceRow(null);
      setBusyId(null);
      router.refresh();
    });
  }

  function handleReserve(row: StudentSessionRow) {
    if (row.allowsRecurring && !row.enrolledSlot) {
      setChoiceRow(row);
      return;
    }
    bookSingle(row);
  }

  function handleCancel(row: StudentSessionRow) {
    if (!row.bookingId) return;
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      const result = await cancelBooking(row.bookingId!);
      if (!result.success) {
        setError(result.error);
        setBusyId(null);
        return;
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, bookingId: null, bookedCount: Math.max(0, s.bookedCount - 1) } : s))
      );
      setBusyId(null);
    });
  }

  if (sessions.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-500 font-body italic border border-line">
        No hay turnos disponibles en las próximas semanas.
      </p>
    );
  }

  return (
    <div className="border border-line">
      <ul className="divide-y divide-line">
        {sessions.map((s) => {
          const full = s.capacity !== null && s.bookedCount >= s.capacity && !s.bookingId;
          return (
            <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-white font-heading font-bold text-sm">
                    {s.activityName} · {formatDateArg(new Date(s.date))} · {formatTime(s.startsAt, timezone)}–
                    {formatTime(s.endsAt, timezone)}
                  </p>
                  <p className="text-gray-500 text-xs font-body">
                    {s.capacity === null ? "Sin límite de cupo" : `${s.bookedCount}/${s.capacity} anotados`}
                    {s.cancelled && <span className="ml-2 text-brand-red">· Cancelada</span>}
                    {s.enrolledSlot && !s.cancelled && <span className="ml-2 text-gray-400">· Inscripción recurrente</span>}
                  </p>
                </div>
              </div>

              {!s.cancelled && canBook && (
                <>
                  {s.bookingId ? (
                    <Button variant="danger" size="sm" loading={isPending && busyId === s.id} onClick={() => handleCancel(s)}>
                      Cancelar
                    </Button>
                  ) : full ? (
                    <span className="text-xs font-heading font-bold uppercase tracking-wide text-gray-600">Sin cupo</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isPending && busyId === s.id}
                      onClick={() => handleReserve(s)}
                    >
                      Reservar
                    </Button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      <RecurringChoiceDialog
        open={choiceRow !== null}
        activityName={choiceRow?.activityName ?? ""}
        dayLabel={choiceRow?.dayOfWeek !== null && choiceRow?.dayOfWeek !== undefined ? `los ${DAY_NAMES[choiceRow.dayOfWeek]}` : ""}
        loading={isPending}
        onChooseSingle={() => choiceRow && bookSingle(choiceRow)}
        onChooseAll={() => choiceRow && enrollAll(choiceRow)}
        onCancel={() => setChoiceRow(null)}
      />
    </div>
  );
}
