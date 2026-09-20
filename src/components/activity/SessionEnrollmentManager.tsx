"use client";

import { manuallyBookStudent, manuallyUnbookStudent } from "@/actions/activity";
import { SessionEnrollmentManagerView } from "@/components/activity/views/SessionEnrollmentManagerView";
import type {
  EnrollmentBookingRow,
  StudentOption,
} from "@/components/activity/views/view-models";

export type BookingRow = EnrollmentBookingRow;
export type { StudentOption } from "@/components/activity/views/view-models";

interface Props {
  sessionId: string;
  cancelled: boolean;
  bookings: EnrollmentBookingRow[];
  availableStudents: StudentOption[];
}

/** Production adapter: manual-booking action arguments remain unchanged. */
export function SessionEnrollmentManager({
  sessionId,
  cancelled,
  bookings,
  availableStudents,
}: Props) {
  return (
    <SessionEnrollmentManagerView
      cancelled={cancelled}
      bookings={bookings}
      availableStudents={availableStudents}
      onBook={(studentId) => manuallyBookStudent(sessionId, studentId)}
      onUnbook={manuallyUnbookStudent}
    />
  );
}
