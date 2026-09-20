"use client";

import { cancelBooking, cancelEnrollment } from "@/actions/booking";
import { MyTurnosView } from "@/components/activity/views/MyTurnosView";
import type { MyBookingRow, MyEnrollmentRow } from "@/components/activity/views/view-models";

export type { MyBookingRow, MyEnrollmentRow } from "@/components/activity/views/view-models";

interface Props {
  timezone: string;
  bookings: MyBookingRow[];
  enrollments: MyEnrollmentRow[];
}

/** Production adapter: keeps Server Action argument mapping unchanged. */
export function MyTurnos({ timezone, bookings, enrollments }: Props) {
  const viewKey = `${bookings.map((booking) => booking.bookingId).join("|")}::${enrollments.map((enrollment) => enrollment.enrollmentId).join("|")}`;

  return (
    <MyTurnosView
      key={viewKey}
      timezone={timezone}
      bookings={bookings}
      enrollments={enrollments}
      onCancelBooking={(row) => cancelBooking(row.bookingId)}
      onCancelEnrollment={(row) => cancelEnrollment(row.enrollmentId)}
    />
  );
}
