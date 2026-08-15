"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { manuallyBookStudent, manuallyUnbookStudent } from "@/actions/activity";
import type { AccountKind } from "@prisma/client";

interface BookingRow {
  bookingId: string;
  userId: string;
  name: string;
  accountKind: AccountKind;
  /** true si lo anotó gestión (createdById != null); false = auto-reserva del alumno. */
  addedByStaff: boolean;
}

interface StudentOption {
  id: string;
  name: string;
  accountKind: AccountKind;
}

interface Props {
  sessionId: string;
  cancelled: boolean;
  bookings: BookingRow[];
  availableStudents: StudentOption[];
}

export function SessionEnrollmentManager({
  sessionId,
  cancelled,
  bookings: initialBookings,
  availableStudents: initialAvailable,
}: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [available, setAvailable] = useState(initialAvailable);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleBook() {
    if (!selectedStudentId) return;
    const student = available.find((s) => s.id === selectedStudentId);
    if (!student) return;
    setError(null);
    startTransition(async () => {
      const result = await manuallyBookStudent(sessionId, selectedStudentId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBookings((prev) => [
        ...prev,
        { bookingId: result.bookingId, userId: student.id, name: student.name, accountKind: student.accountKind, addedByStaff: true },
      ]);
      setAvailable((prev) => prev.filter((s) => s.id !== student.id));
      setSelectedStudentId("");
    });
  }

  function handleUnbook(booking: BookingRow) {
    setError(null);
    setBusyId(booking.bookingId);
    startTransition(async () => {
      const result = await manuallyUnbookStudent(booking.bookingId);
      if (!result.success) {
        setError(result.error);
      } else {
        setBookings((prev) => prev.filter((b) => b.bookingId !== booking.bookingId));
        setAvailable((prev) =>
          [...prev, { id: booking.userId, name: booking.name, accountKind: booking.accountKind }].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
      }
      setBusyId(null);
    });
  }

  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Inscriptos
          <span className="ml-2 text-gray-600">({bookings.length})</span>
        </p>
      </div>

      {bookings.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic">Todavía no hay alumnos anotados.</p>
      ) : (
        <ul className="divide-y divide-line">
          {bookings.map((b) => (
            <li key={b.bookingId} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-heading font-bold text-sm">{b.name}</p>
                <p className="text-gray-500 text-xs font-body">
                  {[b.accountKind === "LITE" ? "Cuenta LITE" : null, b.addedByStaff ? "Anotado por gestión" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {!cancelled && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={isPending && busyId === b.bookingId}
                  onClick={() => handleUnbook(b)}
                >
                  Desanotar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!cancelled && (
        <div className="px-4 py-3 border-t border-line flex gap-2 items-center flex-wrap">
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            disabled={isPending || available.length === 0}
            className="flex-1 bg-panel border border-edge text-gray-400 text-xs font-body px-2 py-1.5 focus:outline-none focus:border-brand-red transition-colors duration-200"
          >
            <option value="">{available.length === 0 ? "No hay más alumnos para anotar" : "Anotar alumno..."}</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.accountKind === "LITE" ? " (LITE)" : ""}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={handleBook} loading={isPending} disabled={!selectedStudentId}>
            Anotar
          </Button>
        </div>
      )}

      {error && (
        <p className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
