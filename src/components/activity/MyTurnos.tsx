"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cancelBooking, cancelEnrollment } from "@/actions/booking";
import { formatDateArg } from "@/lib/dates";
import { DAY_NAMES, formatMinutes } from "@/components/activity/format";

export interface MyBookingRow {
  bookingId: string;
  activityName: string;
  date: string; // ISO (@db.Date)
  startsAt: string; // ISO
  endsAt: string; // ISO
}

export interface MyEnrollmentRow {
  enrollmentId: string;
  activityName: string;
  /** Las inscripciones recurrentes solo existen sobre actividades WEEKLY: nunca es null en la práctica. */
  dayOfWeek: number | null;
  startMinute: number;
  endMinute: number;
}

interface Props {
  timezone: string;
  bookings: MyBookingRow[];
  enrollments: MyEnrollmentRow[];
}

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
}

export function MyTurnos({ timezone, bookings: initialBookings, enrollments: initialEnrollments }: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancelBooking(row: MyBookingRow) {
    setError(null);
    setBusyId(row.bookingId);
    startTransition(async () => {
      const result = await cancelBooking(row.bookingId);
      if (!result.success) {
        setError(result.error);
      } else {
        setBookings((prev) => prev.filter((b) => b.bookingId !== row.bookingId));
      }
      setBusyId(null);
    });
  }

  function handleCancelEnrollment(row: MyEnrollmentRow) {
    setError(null);
    setBusyId(row.enrollmentId);
    startTransition(async () => {
      const result = await cancelEnrollment(row.enrollmentId);
      if (!result.success) {
        setError(result.error);
      } else {
        setEnrollments((prev) => prev.filter((e) => e.enrollmentId !== row.enrollmentId));
      }
      setBusyId(null);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="px-4 py-2 border border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      <section>
        <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
          Próximos turnos
        </h2>
        {bookings.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500 font-body italic border border-line">
            Todavía no tenés turnos reservados.
          </p>
        ) : (
          <div className="border border-line">
            <ul className="divide-y divide-line">
              {bookings.map((b) => (
                <li key={b.bookingId} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-heading font-bold text-sm">
                      {b.activityName} · {formatDateArg(new Date(b.date))} · {formatTime(b.startsAt, timezone)}–
                      {formatTime(b.endsAt, timezone)}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={isPending && busyId === b.bookingId}
                    onClick={() => handleCancelBooking(b)}
                  >
                    Cancelar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
          Inscripciones recurrentes
        </h2>
        {enrollments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500 font-body italic border border-line">
            No estás inscripto de forma recurrente a ningún horario.
          </p>
        ) : (
          <div className="border border-line">
            <ul className="divide-y divide-line">
              {enrollments.map((e) => (
                <li key={e.enrollmentId} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-heading font-bold text-sm">
                      {e.activityName} · Todos los {e.dayOfWeek !== null ? DAY_NAMES[e.dayOfWeek] : ""} ·{" "}
                      {formatMinutes(e.startMinute)}–{formatMinutes(e.endMinute)}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={isPending && busyId === e.enrollmentId}
                    onClick={() => handleCancelEnrollment(e)}
                  >
                    Cancelar inscripción
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
