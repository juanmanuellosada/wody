"use client";

import { useState } from "react";
import { ActivityListView } from "../../activity/views/ActivityListView";
import { ActivitySessionListView } from "../../activity/views/ActivitySessionListView";
import { ActivitySlotManagerView } from "../../activity/views/ActivitySlotManagerView";
import { SessionEnrollmentManagerView } from "../../activity/views/SessionEnrollmentManagerView";
import type {
  ActivityActionResult,
  DeleteActivityPreview,
  DeleteActivityResult,
  SimpleActionResult,
  SlotActionResult,
} from "../../activity/views/view-models";
import { Button } from "../../ui/Button";
import {
  activeGymTurnosActor,
  applyGymTurnosBookingNameOverrides,
  applyGymTurnosStudentOptionNameOverrides,
  gymTurnosBookingRevision,
  gymTurnosListRevision,
  gymTurnosSessionsRevision,
  gymTurnosSlotsRevision,
  gymTurnosTeachers,
  isGymTurnosStaff,
  toGymTurnosManagementActivityInput,
  visibleGymTurnosActivityIds,
} from "./gym-turnos-demo-adapters";
import {
  previewGymTurnosActivityDeletion,
  toGymTurnosActivityListRows,
  toAvailableGymTurnosStudentOptions,
  toGymTurnosEnrollmentBookingRows,
  toGymTurnosSessionRows,
  toGymTurnosSlotRows,
} from "./gym-turnos-demo-state";
import type {
  GymTurnosDemoCommand,
  GymTurnosDemoState,
  GymTurnosResult,
} from "./gym-turnos-demo-types";

type ManagementCommandResult =
  | GymTurnosResult
  | ActivityActionResult
  | SlotActionResult
  | DeleteActivityResult
  | { success: true; bookingId: string };
type Props = {
  state: GymTurnosDemoState;
  now: Date;
  run: (command: GymTurnosDemoCommand) => Promise<ManagementCommandResult>;
  /** Display-only student id -> current editable name, from the profile bridge. Read once by the caller. */
  nameOverrides: ReadonlyMap<string, string>;
};
type Screen =
  | { type: "activities" }
  | { type: "activity"; activityId: string }
  | { type: "session"; activityId: string; sessionId: string };

function asActivityResult(result: ManagementCommandResult): ActivityActionResult {
  return result as ActivityActionResult;
}
function asSlotResult(result: ManagementCommandResult): SlotActionResult {
  return result as SlotActionResult;
}
function asSimpleResult(result: ManagementCommandResult): SimpleActionResult {
  return result as SimpleActionResult;
}
function asDeleteResult(result: ManagementCommandResult): DeleteActivityResult {
  return result as DeleteActivityResult;
}
function asBookingResult(result: ManagementCommandResult) {
  return result as { success: true; bookingId: string } | { success: false; error: string };
}

/** Action-free adapter around the extracted staff management views, GYM roster and bridge names. */
export function GymManagementDemo({ state, now, run, nameOverrides }: Props) {
  const [screen, setScreen] = useState<Screen>({ type: "activities" });
  const actor = activeGymTurnosActor(state);
  const visibleIds = visibleGymTurnosActivityIds(state);
  const activities = toGymTurnosActivityListRows(state).filter(
    (activity) => activity.active && visibleIds.has(activity.id),
  );

  if (!isGymTurnosStaff(actor)) return null;

  if (screen.type === "activity" || screen.type === "session") {
    const activityId = screen.activityId;
    const activity = state.activities.find(
      (candidate) => candidate.id === activityId && visibleIds.has(candidate.id),
    );
    if (!activity) {
      return <ManagementBack onClick={() => setScreen({ type: "activities" })} />;
    }

    if (screen.type === "session") {
      const session = state.sessions.find(
        (candidate) => candidate.id === screen.sessionId && candidate.activityId === activity.id,
      );
      if (!session) {
        return (
          <ManagementBack
            label="Volver a la actividad"
            onClick={() => setScreen({ type: "activity", activityId: activity.id })}
          />
        );
      }
      const bookings = applyGymTurnosBookingNameOverrides(toGymTurnosEnrollmentBookingRows(state, session.id), nameOverrides);
      const availableStudents = applyGymTurnosStudentOptionNameOverrides(toAvailableGymTurnosStudentOptions(state, session.id), nameOverrides);
      return (
        <section className="flex flex-col gap-5" aria-label={`Gestión de ${activity.name}`}>
          <ManagementCrumbs
            activityName={activity.name}
            sessionLabel={session.date}
            onActivities={() => setScreen({ type: "activities" })}
            onActivity={() => setScreen({ type: "activity", activityId: activity.id })}
          />
          <div>
            <h2 className="font-heading text-2xl font-bold uppercase tracking-[0.1em] text-white">
              Inscriptos
            </h2>
            <p className="mt-1 font-body text-sm text-gray-400">
              Gestión local de {activity.name}. Los cupos se actualizan para todos los actores ficticios.
            </p>
          </div>
          <SessionEnrollmentManagerView
            key={gymTurnosBookingRevision(bookings, availableStudents)}
            cancelled={session.cancelled}
            bookings={bookings}
            availableStudents={availableStudents}
            onBook={(studentId) =>
              run({ type: "manual-book", sessionId: session.id, studentId }).then(asBookingResult)
            }
            onUnbook={(bookingId) =>
              run({ type: "manual-unbook", bookingId }).then(asSimpleResult)
            }
          />
        </section>
      );
    }

    const slots = toGymTurnosSlotRows(state, activity.id);
    const sessions = toGymTurnosSessionRows(state, activity.id);
    return (
      <section className="flex flex-col gap-7" aria-label={`Actividad ${activity.name}`}>
        <ManagementCrumbs
          activityName={activity.name}
          onActivities={() => setScreen({ type: "activities" })}
        />
        <div>
          <h2 className="font-heading text-2xl font-bold uppercase tracking-[0.1em] text-white">
            {activity.name}
          </h2>
          <p className="mt-1 font-body text-sm text-gray-400">
            {activity.scheduleKind === "WEEKLY" ? "Actividad semanal" : "Actividad de fecha única"} · gestión ficticia local.
          </p>
        </div>
        <section>
          <h3 className="mb-3 font-heading text-lg font-bold uppercase tracking-[0.15em] text-gray-300">Horarios</h3>
          <ActivitySlotManagerView
            key={gymTurnosSlotsRevision(slots)}
            scheduleKind={activity.scheduleKind}
            slots={slots}
            onCreate={(input) => run({ type: "create-slot", activityId: activity.id, input }).then(asSlotResult)}
            onUpdate={(slotId, input) => run({ type: "update-slot", activityId: activity.id, slotId, input }).then(asSlotResult)}
            onDeactivate={(slotId) => run({ type: "deactivate-slot", activityId: activity.id, slotId }).then(asSimpleResult)}
          />
        </section>
        <section>
          <h3 className="mb-3 font-heading text-lg font-bold uppercase tracking-[0.15em] text-gray-300">Sesiones</h3>
          <ActivitySessionListView
            key={gymTurnosSessionsRevision(sessions)}
            timezone="America/Argentina/Buenos_Aires"
            sessions={sessions}
            getSessionHref={(sessionId) => `#demo-session-${sessionId}`}
            onNavigate={(sessionId) => setScreen({ type: "session", activityId: activity.id, sessionId })}
            onCancel={(sessionId) => run({ type: "cancel-session", sessionId }).then(asSimpleResult)}
          />
        </section>
      </section>
    );
  }

  const listRevision = gymTurnosListRevision(activities);
  return (
    <section className="flex flex-col gap-5" aria-label="Gestión de actividades">
      <div>
        <h2 className="font-heading text-2xl font-bold uppercase tracking-[0.1em] text-white">Gestión del gimnasio</h2>
        <p className="mt-1 font-body text-sm text-gray-400">
          {actor.role === "ADMIN" ? "Administración local de todas las actividades." : "Solo podés gestionar tus propias actividades ficticias."}
        </p>
      </div>
      <ActivityListView
        key={listRevision}
        activities={activities}
        teachers={gymTurnosTeachers(state)}
        canAssignTeacher={actor.role === "ADMIN"}
        getActivityHref={(activityId) => `#demo-activity-${activityId}`}
        onNavigate={(activityId) => setScreen({ type: "activity", activityId })}
        notificationMode="simulated"
        onCreate={(input, slots) =>
          run({ type: "create-activity", input: toGymTurnosManagementActivityInput(input), slots }).then(asActivityResult)
        }
        onUpdate={(activityId, input) => {
          const existing = state.activities.find((activity) => activity.id === activityId);
          return run({
            type: "update-activity",
            activityId,
            input: toGymTurnosManagementActivityInput(input, existing),
          }).then(asActivityResult);
        }}
        onPreviewDelete={(activityId) => {
          const preview = previewGymTurnosActivityDeletion(state, activityId, now).result;
          return Promise.resolve(preview as DeleteActivityPreview);
        }}
        onDelete={(activityId) => run({ type: "delete-activity", activityId }).then(asDeleteResult)}
      />
    </section>
  );
}

function ManagementCrumbs({
  activityName,
  sessionLabel,
  onActivities,
  onActivity,
}: {
  activityName: string;
  sessionLabel?: string;
  onActivities: () => void;
  onActivity?: () => void;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-500" aria-label="Ruta de gestión">
      <button type="button" className="hover:text-white" onClick={onActivities}>Actividades</button>
      <span>/</span>
      {onActivity ? (
        <button type="button" className="hover:text-white" onClick={onActivity}>{activityName}</button>
      ) : (
        <span className="text-gray-300">{activityName}</span>
      )}
      {sessionLabel && <><span>/</span><span className="text-gray-300">{sessionLabel}</span></>}
    </nav>
  );
}

function ManagementBack({ label = "Volver a actividades", onClick }: { label?: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>{label}</Button>
  );
}
