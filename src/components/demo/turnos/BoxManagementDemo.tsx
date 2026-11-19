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
  activeDemoActor,
  bookingRevision,
  demoTeachers,
  isStaff,
  sessionsRevision,
  slotsRevision,
  toManagementActivityInput,
  visibleManagementActivityIds,
} from "./demo-view-adapters";
import {
  previewManagedActivityDeletion,
  toActivityListRows,
  toAvailableStudentOptions,
  toEnrollmentBookingRows,
  toManagedSessionRows,
  toManagedSlotRows,
} from "./management-demo-state";
import type {
  ManagementDemoCommand,
  ManagementDemoState,
  ManagementResult,
} from "./management-demo-types";

type ManagementCommandResult =
  | ManagementResult
  | ActivityActionResult
  | SlotActionResult
  | DeleteActivityResult
  | { success: true; bookingId: string };
type Props = {
  state: ManagementDemoState;
  now: Date;
  run: (command: ManagementDemoCommand) => Promise<ManagementCommandResult>;
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

/** Action-free adapter around the extracted staff management views. */
export function BoxManagementDemo({ state, now, run }: Props) {
  const [screen, setScreen] = useState<Screen>({ type: "activities" });
  const actor = activeDemoActor(state);
  const visibleIds = visibleManagementActivityIds(state);
  const activities = toActivityListRows(state).filter(
    (activity) => activity.active && visibleIds.has(activity.id),
  );

  if (!isStaff(actor)) return null;

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
      const bookings = toEnrollmentBookingRows(state, session.id);
      const availableStudents = toAvailableStudentOptions(state, session.id);
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
            key={bookingRevision(bookings, availableStudents)}
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

    const slots = toManagedSlotRows(state, activity.id);
    const sessions = toManagedSessionRows(state, activity.id);
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
            key={slotsRevision(slots)}
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
            key={sessionsRevision(sessions)}
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

  const listRevision = activities
    .map((activity) => `${activity.id}:${activity.name}:${activity.teacherId}:${activity.active}`)
    .join("|");
  return (
    <section className="flex flex-col gap-5" aria-label="Gestión de actividades">
      <div>
        <h2 className="font-heading text-2xl font-bold uppercase tracking-[0.1em] text-white">Gestión del box</h2>
        <p className="mt-1 font-body text-sm text-gray-400">
          {actor.role === "ADMIN" ? "Administración local de todas las actividades." : "Solo podés gestionar tus propias actividades ficticias."}
        </p>
      </div>
      <ActivityListView
        key={listRevision}
        activities={activities}
        teachers={demoTeachers(state)}
        canAssignTeacher={actor.role === "ADMIN"}
        getActivityHref={(activityId) => `#demo-activity-${activityId}`}
        onNavigate={(activityId) => setScreen({ type: "activity", activityId })}
        notificationMode="simulated"
        onCreate={(input, slots) =>
          run({ type: "create-activity", input: toManagementActivityInput(input), slots }).then(asActivityResult)
        }
        onUpdate={(activityId, input) => {
          const existing = state.activities.find((activity) => activity.id === activityId);
          return run({
            type: "update-activity",
            activityId,
            input: toManagementActivityInput(input, existing),
          }).then(asActivityResult);
        }}
        onPreviewDelete={(activityId) => {
          const preview = previewManagedActivityDeletion(state, activityId, now).result;
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
