import type {
  ActivityRow,
  DeleteActivityResult,
  SlotInput,
  TeacherOption,
} from "../../activity/views/view-models";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { selectManagementDemoActor } from "./management-demo-state.ts";
import type {
  DemoActor,
  DemoRole,
  ManagementActivityInput,
  ManagementDemoState,
  ManagementDeletionResult,
  ManagementResult,
} from "./management-demo-types";

export const MANAGEMENT_DEMO_STORAGE_KEY = "wody-box-turnos-demo-v2";

export type DemoActivityDialogInput = Omit<
  ActivityRow,
  "id" | "teacherName" | "active" | "teacherId"
> & { teacherId?: string | null };

export function activeDemoActor(state: ManagementDemoState): DemoActor {
  const actor = state.actors.find((candidate) => candidate.id === state.activeActorId);
  if (!actor) throw new Error("The validated demo state must have an active actor.");
  return actor;
}

/** Applies a route's optional initial identity without changing any simulated records. */
export function selectInitialDemoActor(
  state: ManagementDemoState,
  initialRole?: DemoRole,
): ManagementDemoState {
  if (!initialRole) return state;
  const actor = state.actors.find((candidate) => candidate.role === initialRole);
  if (!actor || actor.id === state.activeActorId) return state;
  return selectManagementDemoActor(state, actor.id).state;
}

export function demoStudents(state: ManagementDemoState): DemoActor[] {
  return state.actors.filter((actor) => actor.role === "STUDENT");
}

export function demoTeachers(state: ManagementDemoState): TeacherOption[] {
  return state.actors
    .filter((actor) => actor.role === "TEACHER")
    .map((teacher) => ({ id: teacher.id, name: teacher.name }));
}

export function visibleManagementActivityIds(state: ManagementDemoState): Set<string> {
  const actor = activeDemoActor(state);
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
export function toManagementActivityInput(
  input: DemoActivityDialogInput,
  existing?: ActivityRow,
): ManagementActivityInput {
  return {
    ...input,
    teacherId: input.teacherId ?? existing?.teacherId ?? null,
  };
}

export function toDeleteActivityResult(
  result: ManagementDeletionResult,
): DeleteActivityResult {
  return result;
}

export function toSimpleResult(result: ManagementResult): ManagementResult {
  return result;
}

/** Keys remount extracted views whose local state mirrors incoming rows. */
export function rowsRevision(
  rows: readonly { id?: string; bookingId?: string; enrollmentId?: string }[],
): string {
  return rows
    .map((row) => row.id ?? row.bookingId ?? row.enrollmentId ?? "unknown")
    .join("|");
}

export function slotsRevision(
  slots: readonly { id: string; active: boolean; startMinute: number; endMinute: number }[],
): string {
  return slots.map((slot) => `${slot.id}:${slot.active}:${slot.startMinute}:${slot.endMinute}`).join("|");
}

export function sessionsRevision(
  sessions: readonly { id: string; bookedCount: number; cancelled: boolean }[],
): string {
  return sessions.map((session) => `${session.id}:${session.bookedCount}:${session.cancelled}`).join("|");
}

export function bookingRevision(
  bookings: readonly { bookingId: string }[],
  availableStudents: readonly { id: string }[],
): string {
  return `${rowsRevision(bookings)}::${rowsRevision(availableStudents)}`;
}

export function isStaff(actor: DemoActor): boolean {
  return actor.role === "ADMIN" || actor.role === "TEACHER";
}

export type { SlotInput };
