export type ActivityScheduleKind = "WEEKLY" | "ONE_OFF";
export type AccountKind = "FULL" | "LITE";

export interface TeacherOption {
  id: string;
  name: string;
}

export interface ActivityRow {
  id: string;
  name: string;
  description: string | null;
  teacherId: string | null;
  teacherName: string | null;
  scheduleKind: ActivityScheduleKind;
  allowsRecurring: boolean;
  cancelWindowHours: number;
  capacity: number | null;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
}

export interface SlotInput {
  dayOfWeek: number | null;
  date: string | null;
  startMinute: number;
  endMinute: number;
  capacity: number | null;
}

export interface SlotRow extends SlotInput {
  id: string;
  active: boolean;
}

export interface SessionRow {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  bookedCount: number;
  cancelled: boolean;
}

export interface EnrollmentBookingRow {
  bookingId: string;
  userId: string;
  name: string;
  accountKind: AccountKind;
  addedByStaff: boolean;
}

export interface StudentOption {
  id: string;
  name: string;
  accountKind: AccountKind;
}

export type ActivityActionResult =
  | { success: true; activity: ActivityRow }
  | { success: false; error: string };
export type SlotActionResult =
  | { success: true; slot: SlotRow }
  | { success: false; error: string };
export type DeleteActivityPreview =
  | { success: true; willArchive: boolean; futureBookedStudents: number }
  | { success: false; error: string };
export type DeleteActivityResult =
  | {
      success: true;
      mode: "deleted" | "archived";
      futureBookedStudents: number;
    }
  | { success: false; error: string };

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

export type SimpleActionResult =
  | { success: true }
  | { success: false; error: string };
