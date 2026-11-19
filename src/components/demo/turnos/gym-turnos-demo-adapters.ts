import type {
  ActivityRow,
  EnrollmentBookingRow,
  MyBookingRow,
  MyEnrollmentRow,
  SessionRow,
  StudentOption,
  TeacherOption,
} from "../../activity/views/view-models";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { selectGymTurnosDemoActor } from "./gym-turnos-demo-state.ts";
import type {
  ActivityListRow,
  GymTurnosDemoActor,
  GymTurnosDemoRole,
  GymTurnosDemoState,
  SlotRow,
} from "./gym-turnos-demo-types";

export type GymActivityDialogInput = Omit<
  ActivityRow,
  "id" | "teacherName" | "active" | "teacherId"
> & { teacherId?: string | null };

export function activeGymTurnosActor(state: GymTurnosDemoState): GymTurnosDemoActor {
  const actor = state.actors.find((candidate) => candidate.id === state.activeActorId);
  if (!actor) throw new Error("The validated GYM turnos demo state must have an active actor.");
  return actor;
}

/** Applies a route's optional initial identity without changing any simulated records. */
export function selectInitialGymTurnosActor(
  state: GymTurnosDemoState,
  initialRole?: GymTurnosDemoRole,
): GymTurnosDemoState {
  if (!initialRole) return state;
  const actor = state.actors.find((candidate) => candidate.role === initialRole);
  if (!actor || actor.id === state.activeActorId) return state;
  return selectGymTurnosDemoActor(state, actor.id).state;
}

export function isGymTurnosStaff(actor: GymTurnosDemoActor): boolean {
  return actor.role === "ADMIN" || actor.role === "TEACHER";
}

export function gymTurnosStudents(state: GymTurnosDemoState): GymTurnosDemoActor[] {
  return state.actors.filter((actor) => actor.role === "STUDENT");
}

export function gymTurnosTeachers(state: GymTurnosDemoState): TeacherOption[] {
  return state.actors
    .filter((actor) => actor.role === "TEACHER")
    .map((teacher) => ({ id: teacher.id, name: teacher.name }));
}

export function visibleGymTurnosActivityIds(state: GymTurnosDemoState): Set<string> {
  const actor = activeGymTurnosActor(state);
  if (actor.role === "ADMIN") return new Set(state.activities.map((activity) => activity.id));
  if (actor.role === "TEACHER") {
    return new Set(
      state.activities
        .filter((activity) => activity.teacherId === actor.id)
        .map((activity) => activity.id),
    );
  }
  return new Set();
}

/** Preserves an existing teacher when the dialog intentionally omits its selector. */
export function toGymTurnosManagementActivityInput(
  input: GymActivityDialogInput,
  existing?: ActivityRow,
) {
  return {
    ...input,
    teacherId: input.teacherId ?? existing?.teacherId ?? null,
  };
}

/**
 * This whole family keys remount for extracted views that copy their rows into local state once at
 * mount (ActivityListView.tsx:50; ActivitySlotManagerView / ActivitySessionListView /
 * SessionEnrollmentManagerView / TurnosCalendarView.tsx:32 are the same shape): a field the view
 * displays but that this key does not fold is invisible until an unrelated remount happens to
 * occur. Every builder below derives its key from the *entire* row (or, for the two composite
 * builders further down, the entire set of rows) the view actually receives — the row type is the
 * real contract — via a stable JSON serialization, produced consistently by the same pure
 * projection every render, rather than a hand-picked field list that goes stale the moment the view
 * starts displaying a field it didn't before. That hand-picked-list failure is exactly what
 * happened here three times: first the bridge-editable name, then capacity and schedule, then the
 * student calendar. The tradeoff is deliberate and accepted: a whole-row key can force a remount
 * over a field the view does not actually render, which is the conservative direction — the same
 * call made for the payment dedupe key's order-sensitivity.
 */
export function gymTurnosListRevision(activities: readonly ActivityListRow[]): string {
  return activities.map((activity) => JSON.stringify(activity)).join("|");
}

export function gymTurnosSlotsRevision(slots: readonly SlotRow[]): string {
  return slots.map((slot) => JSON.stringify(slot)).join("|");
}

export function gymTurnosSessionsRevision(sessions: readonly SessionRow[]): string {
  return sessions.map((session) => JSON.stringify(session)).join("|");
}

/** Generic row-list revision for a single group of rows, e.g. GymBookingDemo's own calendar key (StudentSessionRow[]). */
export function gymTurnosRowsRevision(rows: readonly unknown[]): string {
  return rows.map((row) => JSON.stringify(row)).join("|");
}

/**
 * Bookings and available students are different row shapes (EnrollmentBookingRow vs
 * StudentOption): they are combined under two distinct object keys, not string-concatenated, so
 * the two groups can never be mistaken for each other regardless of what either row shape happens
 * to contain (a bridge-edited student name, for instance, is free text and could itself contain
 * any separator a naive string join might pick).
 */
export function gymTurnosBookingRevision(
  bookings: readonly EnrollmentBookingRow[],
  availableStudents: readonly StudentOption[],
): string {
  return JSON.stringify({ bookings, availableStudents });
}

/** Same two-distinct-keys composition as gymTurnosBookingRevision, for GymBookingDemo's own "mis turnos" key. */
export function gymTurnosMyTurnosRevision(
  bookings: readonly MyBookingRow[],
  enrollments: readonly MyEnrollmentRow[],
): string {
  return JSON.stringify({ bookings, enrollments });
}

/**
 * Display-only resolver for a bridge-editable student name. A blank or whitespace-only override
 * is not a display name; the canonical name is used instead, matching the resolver established by
 * the GYM training route (DemoGymTrainingRoute.tsx resolveGymDisplayName) and the overlay maps
 * built by DemoGymFeesAdapter/DemoGymAccessKiosk. `nameOverrides` must be read fresh at render and
 * passed in as a plain argument, never cached in a ref or mirrored with an effect.
 */
export function resolveGymTurnosDisplayName(
  nameOverrides: ReadonlyMap<string, string>,
  id: string,
  canonicalName: string,
): string {
  const override = nameOverrides.get(id);
  return override !== undefined && override.trim() !== "" ? override : canonicalName;
}

/**
 * Overlays bridge display names onto the pure projection's booking rows. The pure projection
 * (toGymTurnosEnrollmentBookingRows) sorts by canonical name; re-sorting here keeps the rendered
 * order consistent with the names actually shown after the overlay is applied.
 */
export function applyGymTurnosBookingNameOverrides(
  rows: readonly EnrollmentBookingRow[],
  nameOverrides: ReadonlyMap<string, string>,
): EnrollmentBookingRow[] {
  return rows
    .map((row) => ({ ...row, name: resolveGymTurnosDisplayName(nameOverrides, row.userId, row.name) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** Same overlay-then-resort rule as applyGymTurnosBookingNameOverrides, for the manual-book picker. */
export function applyGymTurnosStudentOptionNameOverrides(
  rows: readonly StudentOption[],
  nameOverrides: ReadonlyMap<string, string>,
): StudentOption[] {
  return rows
    .map((row) => ({ ...row, name: resolveGymTurnosDisplayName(nameOverrides, row.id, row.name) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
