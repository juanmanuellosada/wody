"use client";

import { useRouter } from "next/navigation";
import { bookSingleSession, cancelBooking, enrollInSlot } from "@/actions/booking";
import { TurnosCalendarView } from "@/components/activity/views/TurnosCalendarView";
import type { StudentSessionRow } from "@/components/activity/views/view-models";

export type { StudentSessionRow } from "@/components/activity/views/view-models";

interface Props {
  timezone: string;
  sessions: StudentSessionRow[];
  /** false para cuentas LITE: no se expone la acción de reservar. */
  canBook: boolean;
}

/** Production adapter: keeps Server Action argument mapping and refresh semantics. */
export function TurnosCalendar({ timezone, sessions, canBook }: Props) {
  const router = useRouter();
  const viewKey = sessions.map((session) => `${session.id}:${session.bookingId}:${session.bookedCount}:${session.enrolledSlot}`).join("|");

  return (
    <TurnosCalendarView
      key={viewKey}
      timezone={timezone}
      sessions={sessions}
      canBook={canBook}
      onBookSingle={(row) => bookSingleSession(row.id)}
      onEnrollAll={async (row) => {
        const result = await enrollInSlot(row.slotId);
        if (result.success) router.refresh();
        return result;
      }}
      onCancelBooking={(row) => cancelBooking(row.bookingId!)}
    />
  );
}
