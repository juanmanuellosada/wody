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

/** Isolated from BOX turnos: own namespace, own storage key, never reads/writes wody-box-turnos-demo-v2. */
export const GYM_TURNOS_DEMO_VERSION = 1;
export const GYM_TURNOS_DEMO_STORAGE_KEY = "wody-gym-turnos-demo-v1";
export const GYM_TURNOS_DEMO_TIMEZONE = "America/Argentina/Buenos_Aires";

export type GymTurnosDemoRole = "ADMIN" | "TEACHER" | "STUDENT";
export type GymTurnosBookingSource = "SINGLE" | "ENROLLMENT";
export type GymTurnosBookingStatus = "CONFIRMED" | "CANCELLED";
export type GymTurnosEnrollmentStatus = "ACTIVE" | "CANCELLED";

/**
 * Display-only actor for this module. `id` is the canonical GYM directory token
 * (see gym-demo-directory.ts); this module never mints its own actor identities.
 * `accountKind` is non-null only for STUDENT actors. Unlike BOX's DemoActor (which
 * leaves the field `undefined` for staff), this uses `null` deliberately: an
 * `undefined`-valued own key is dropped by JSON.stringify, which would make this
 * module's closed-shape ownKeys validator (gym-turnos-demo-storage.ts) reject a
 * staff actor after a storage round-trip.
 */
export type GymTurnosDemoActor = {
  id: string;
  name: string;
  role: GymTurnosDemoRole;
  accountKind: AccountKind | null;
};

export type GymManagedSlot = SlotRow & { activityId: string };

/** A session keeps its capacity snapshot; booking counts are always derived. */
export type GymManagedSession = {
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
export type GymManagedBooking = {
  id: string;
  sessionId: string;
  studentId: string;
  source: GymTurnosBookingSource;
  enrollmentId: string | null;
  status: GymTurnosBookingStatus;
  addedByStaff: boolean;
  cancelledAt: string | null;
};

export type GymManagedEnrollment = {
  id: string;
  slotId: string;
  studentId: string;
  status: GymTurnosEnrollmentStatus;
  cancelledAt: string | null;
};

export type GymTurnosDemoState = {
  version: typeof GYM_TURNOS_DEMO_VERSION;
  anchorDate: string;
  activeActorId: string;
  actors: GymTurnosDemoActor[];
  activities: ActivityRow[];
  slots: GymManagedSlot[];
  sessions: GymManagedSession[];
  bookings: GymManagedBooking[];
  enrollments: GymManagedEnrollment[];
};

export type GymTurnosActivityInput = Omit<
  ActivityRow,
  "id" | "teacherName" | "active"
>;
export type GymTurnosResult =
  | { success: true }
  | { success: false; error: string };
export type GymTurnosActivityResult =
  | { success: true; activity: ActivityRow }
  | { success: false; error: string };
export type GymTurnosSlotResult =
  | { success: true; slot: SlotRow }
  | { success: false; error: string };
export type GymTurnosBookingResult =
  | { success: true; bookingId: string }
  | { success: false; error: string };
export type GymTurnosEnrollmentResult =
  | { success: true; enrollmentId: string; bookingsCreated: number }
  | { success: false; error: string };
export type GymTurnosDeletionPreview =
  | { success: true; willArchive: boolean; futureBookedStudents: number }
  | { success: false; error: string };
export type GymTurnosDeletionResult =
  | {
      success: true;
      mode: "deleted" | "archived";
      futureBookedStudents: number;
    }
  | { success: false; error: string };
export type GymTurnosMaterializeResult = { success: true; sessionsCreated: number; bookingsCreated: number };

export type GymTurnosTransition<R> = { state: GymTurnosDemoState; result: R };

/** Commands are intentionally UI-agnostic for future role-aware adapters (candidate 5c). */
export type GymTurnosDemoCommand =
  | { type: "select-actor"; actorId: string }
  | { type: "create-activity"; input: GymTurnosActivityInput; slots: SlotInput[] }
  | { type: "update-activity"; activityId: string; input: GymTurnosActivityInput }
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

export type GymTurnosProjection = {
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
