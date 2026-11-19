import type {
  AccountKind,
  ActivityRow,
  ActivityScheduleKind,
  EnrollmentBookingRow,
  MyBookingRow,
  MyEnrollmentRow,
  SessionRow,
  SlotInput,
  SlotRow,
  StudentOption,
  StudentSessionRow,
} from "../../activity/views/view-models";
import type { ActivityListRow } from "../../activity/ActivityList";

export const MANAGEMENT_DEMO_VERSION = 1;
export const MANAGEMENT_DEMO_TIMEZONE = "America/Argentina/Buenos_Aires";

export type DemoRole = "ADMIN" | "TEACHER" | "STUDENT";
export type BookingSource = "SINGLE" | "ENROLLMENT";
export type BookingStatus = "CONFIRMED" | "CANCELLED";
export type EnrollmentStatus = "ACTIVE" | "CANCELLED";

export type DemoActor = {
  id: string;
  name: string;
  role: DemoRole;
  accountKind?: AccountKind;
};

export type ManagedSlot = SlotRow & { activityId: string };

/** A session keeps its capacity snapshot; booking counts are always derived. */
export type ManagedSession = {
  id: string;
  activityId: string;
  slotId: string;
  date: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  cancelled: boolean;
};

/** One row per student and session, retained after cancellation for history. */
export type ManagedBooking = {
  id: string;
  sessionId: string;
  studentId: string;
  source: BookingSource;
  enrollmentId: string | null;
  status: BookingStatus;
  addedByStaff: boolean;
  cancelledAt: string | null;
};

export type ManagedEnrollment = {
  id: string;
  slotId: string;
  studentId: string;
  status: EnrollmentStatus;
  cancelledAt: string | null;
};

export type ManagementDemoState = {
  version: typeof MANAGEMENT_DEMO_VERSION;
  anchorDate: string;
  activeActorId: string;
  actors: DemoActor[];
  activities: ActivityRow[];
  slots: ManagedSlot[];
  sessions: ManagedSession[];
  bookings: ManagedBooking[];
  enrollments: ManagedEnrollment[];
};

export type ManagementActivityInput = Omit<
  ActivityRow,
  "id" | "teacherName" | "active"
>;
export type ManagementResult =
  | { success: true }
  | { success: false; error: string };
export type ManagementActivityResult =
  | { success: true; activity: ActivityRow }
  | { success: false; error: string };
export type ManagementSlotResult =
  | { success: true; slot: SlotRow }
  | { success: false; error: string };
export type ManagementBookingResult =
  | { success: true; bookingId: string }
  | { success: false; error: string };
export type ManagementEnrollmentResult =
  | { success: true; enrollmentId: string; bookingsCreated: number }
  | { success: false; error: string };
export type ManagementDeletionPreview =
  | { success: true; willArchive: boolean; futureBookedStudents: number }
  | { success: false; error: string };
export type ManagementDeletionResult =
  | {
      success: true;
      mode: "deleted" | "archived";
      futureBookedStudents: number;
    }
  | { success: false; error: string };
export type MaterializeResult = { success: true; sessionsCreated: number; bookingsCreated: number };

export type ManagementTransition<R> = { state: ManagementDemoState; result: R };

/** Commands are intentionally UI-agnostic for the five role-aware adapters. */
export type ManagementDemoCommand =
  | { type: "select-actor"; actorId: string }
  | { type: "create-activity"; input: ManagementActivityInput; slots: SlotInput[] }
  | { type: "update-activity"; activityId: string; input: ManagementActivityInput }
  | { type: "create-slot"; activityId: string; input: SlotInput }
  | { type: "update-slot"; activityId: string; slotId: string; input: SlotInput }
  | { type: "deactivate-slot"; activityId: string; slotId: string }
  | { type: "materialize" }
  | { type: "cancel-session"; sessionId: string }
  | { type: "manual-book"; sessionId: string; studentId: string }
  | { type: "manual-unbook"; bookingId: string }
  | { type: "student-book"; studentId: string; sessionId: string }
  | { type: "student-enroll"; studentId: string; slotId: string }
  | { type: "student-cancel-booking"; studentId: string; bookingId: string }
  | { type: "student-cancel-enrollment"; studentId: string; enrollmentId: string }
  | { type: "delete-activity"; activityId: string };

export type ManagementProjection = {
  activities: ActivityListRow[];
  slots: SlotRow[];
  sessions: SessionRow[];
  bookings: EnrollmentBookingRow[];
  availableStudents: StudentOption[];
  studentSessions: StudentSessionRow[];
  myBookings: MyBookingRow[];
  myEnrollments: MyEnrollmentRow[];
};

export type { ActivityListRow, ActivityRow, ActivityScheduleKind, SlotInput, SlotRow };
