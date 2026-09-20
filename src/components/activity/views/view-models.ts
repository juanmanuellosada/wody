export type ActivityScheduleKind = "WEEKLY" | "ONE_OFF";

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

export type BookingActionResult =
  | { success: true; bookingId: string }
  | { success: false; error: string };

export type EnrollmentActionResult =
  | { success: true; enrollmentId: string; bookingsCreated: number }
  | { success: false; error: string };

export type SimpleActionResult = { success: true } | { success: false; error: string };
