"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type {
  EnrollmentBookingRow,
  SimpleActionResult,
  StudentOption,
} from "./view-models";

type Props = {
  cancelled: boolean;
  bookings: EnrollmentBookingRow[];
  availableStudents: StudentOption[];
  onBook: (
    studentId: string,
  ) => Promise<
    { success: true; bookingId: string } | { success: false; error: string }
  >;
  onUnbook: (bookingId: string) => Promise<SimpleActionResult>;
};

export function SessionEnrollmentManagerView({
  cancelled,
  bookings: initialBookings,
  availableStudents: initialAvailable,
  onBook,
  onUnbook,
}: Props) {
  const [bookings, setBookings] = useState(initialBookings);
  const [available, setAvailable] = useState(initialAvailable);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function book() {
    if (!selectedStudentId) return;
    const student = available.find((value) => value.id === selectedStudentId);
    if (!student) return;
    setError(null);
    startTransition(async () => {
      const result = await onBook(selectedStudentId);
      if (!result.success) return setError(result.error);
      setBookings((rows) => [
        ...rows,
        {
          bookingId: result.bookingId,
          userId: student.id,
          name: student.name,
          accountKind: student.accountKind,
          addedByStaff: true,
        },
      ]);
      setAvailable((rows) => rows.filter((value) => value.id !== student.id));
      setSelectedStudentId("");
    });
  }
  function unbook(booking: EnrollmentBookingRow) {
    setError(null);
    setBusyId(booking.bookingId);
    startTransition(async () => {
      const result = await onUnbook(booking.bookingId);
      if (!result.success) setError(result.error);
      else {
        setBookings((rows) =>
          rows.filter((row) => row.bookingId !== booking.bookingId),
        );
        setAvailable((rows) =>
          [
            ...rows,
            {
              id: booking.userId,
              name: booking.name,
              accountKind: booking.accountKind,
            },
          ].sort((first, second) => first.name.localeCompare(second.name)),
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
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic">
          Todavía no hay alumnos anotados.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {bookings.map((booking) => (
            <li
              key={booking.bookingId}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-white font-heading font-bold text-sm">
                  {booking.name}
                </p>
                <p className="text-gray-500 text-xs font-body">
                  {[
                    booking.accountKind === "LITE" ? "Cuenta LITE" : null,
                    booking.addedByStaff ? "Anotado por gestión" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {!cancelled && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={isPending && busyId === booking.bookingId}
                  onClick={() => unbook(booking)}
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
            onChange={(event) => setSelectedStudentId(event.target.value)}
            disabled={isPending || available.length === 0}
            className="flex-1 bg-panel border border-edge text-gray-400 text-xs font-body px-2 py-1.5 focus:outline-none focus:border-brand-red transition-colors duration-200"
          >
            <option value="">
              {available.length === 0
                ? "No hay más alumnos para anotar"
                : "Anotar alumno..."}
            </option>
            {available.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
                {student.accountKind === "LITE" ? " (LITE)" : ""}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={book}
            loading={isPending}
            disabled={!selectedStudentId}
          >
            Anotar
          </Button>
        </div>
      )}
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
