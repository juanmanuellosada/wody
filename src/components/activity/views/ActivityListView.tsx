"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatActivitySchedule } from "@/components/activity/format";
import { ActivityDialogView } from "./ActivityDialogView";
import type {
  ActivityRow,
  DeleteActivityPreview,
  DeleteActivityResult,
  SlotInput,
  TeacherOption,
} from "./view-models";

type SlotSummary = Pick<
  SlotInput,
  "dayOfWeek" | "date" | "startMinute" | "endMinute"
>;
export type ActivityListRow = ActivityRow & { slots: SlotSummary[] };

type Props = {
  activities: ActivityListRow[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
  getActivityHref: (activityId: string) => string;
  /** Optional local navigation for an action-free demo shell. */
  onNavigate?: (activityId: string) => void;
  /** Presentation-only wording; live is the production default. */
  notificationMode?: "live" | "simulated";
  onCreate: Parameters<typeof ActivityDialogView>[0]["onCreate"];
  onUpdate: Parameters<typeof ActivityDialogView>[0]["onUpdate"];
  onPreviewDelete: (activityId: string) => Promise<DeleteActivityPreview>;
  onDelete: (activityId: string) => Promise<DeleteActivityResult>;
};

export function ActivityListView({
  activities: initial,
  teachers,
  canAssignTeacher,
  getActivityHref,
  onNavigate,
  notificationMode = "live",
  onCreate,
  onUpdate,
  onPreviewDelete,
  onDelete,
}: Props) {
  const [activities, setActivities] = useState(initial);
  const [editing, setEditing] = useState<ActivityListRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
  const [deletePreview, setDeletePreview] = useState<{
    willArchive: boolean;
    futureBookedStudents: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  async function openDeleteConfirm(activity: ActivityRow) {
    setError(null);
    setResultMessage(null);
    setDeleteTarget(activity);
    setDeletePreview(null);
    setPreviewLoading(true);
    const preview = await onPreviewDelete(activity.id);
    setPreviewLoading(false);
    if (!preview.success) {
      setError(preview.error);
      setDeleteTarget(null);
      return;
    }
    setDeletePreview(preview);
  }
  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startDeleteTransition(async () => {
      const result = await onDelete(target.id);
      setDeleteTarget(null);
      setDeletePreview(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setActivities((current) =>
        current.filter((activity) => activity.id !== target.id),
      );
      setResultMessage(
        result.mode === "deleted"
          ? `Se eliminó "${target.name}".`
          : `Se archivó "${target.name}" porque ya tenía alumnos anotados; el historial se conserva.`,
      );
    });
  }
  function confirmMessage() {
    if (!deleteTarget) return "";
    if (previewLoading || !deletePreview) return "Calculando impacto...";
    if (deletePreview.willArchive) {
      const studentsNote =
        deletePreview.futureBookedStudents > 0
          ? notificationMode === "live"
            ? ` ${deletePreview.futureBookedStudents} alumno(s) con reserva futura van a ser notificados.`
            : ` ${deletePreview.futureBookedStudents} alumno(s) tienen una reserva futura afectada. En esta demo no se envían notificaciones.`
          : notificationMode === "simulated"
            ? " En esta demo no se envían notificaciones."
            : "";
      return `"${deleteTarget.name}" ya tuvo alumnos anotados alguna vez, así que se va a archivar: desaparece de la gestión y del calendario, pero se conserva el historial.${studentsNote}`;
    }
    return `¿Eliminar "${deleteTarget.name}"? Nunca tuvo alumnos anotados, así que se borra por completo.`;
  }
  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Actividades
          <span className="ml-2 text-gray-600">({activities.length})</span>
        </p>
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          Nueva actividad
        </Button>
      </div>
      {activities.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic">
          Todavía no hay actividades cargadas.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {activities.map((activity) => (
            <li
              key={activity.id}
              className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-3">
                <div>
                  <Link
                    href={getActivityHref(activity.id)}
                    onClick={
                      onNavigate
                        ? (event) => {
                            event.preventDefault();
                            onNavigate(activity.id);
                          }
                        : undefined
                    }
                    className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
                  >
                    {activity.name}
                  </Link>
                  <p className="text-gray-500 text-xs font-body">
                    {activity.teacherName ?? "Sin profe asignado"}
                  </p>
                  {formatActivitySchedule(
                    activity.scheduleKind,
                    activity.slots,
                    activity.startsOn,
                    activity.endsOn,
                  ) && (
                    <p className="text-gray-500 text-xs font-body">
                      {formatActivitySchedule(
                        activity.scheduleKind,
                        activity.slots,
                        activity.startsOn,
                        activity.endsOn,
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(activity)}
                >
                  Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => openDeleteConfirm(activity)}
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p
          className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
          role="alert"
        >
          {error}
        </p>
      )}
      {resultMessage && (
        <p
          className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-green-500 uppercase tracking-wide"
          role="status"
        >
          {resultMessage}
        </p>
      )}
      {editing && (
        <ActivityDialogView
          activity={editing === "new" ? undefined : editing}
          activitySlotDays={
            editing !== "new"
              ? editing.slots
                  .map((slot) => slot.dayOfWeek)
                  .filter((day): day is number => day !== null)
              : undefined
          }
          teachers={teachers}
          canAssignTeacher={canAssignTeacher}
          onClose={() => setEditing(null)}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onSaved={(saved, slots) => {
            setActivities((current) =>
              editing === "new"
                ? [...current, { ...saved, slots: slots ?? [] }]
                : current.map((activity) =>
                    activity.id === saved.id
                      ? { ...activity, ...saved }
                      : activity,
                  ),
            );
            setEditing(null);
          }}
        />
      )}
      {
        <ConfirmDialog
          open={!!deleteTarget}
          title="Eliminar actividad"
          message={confirmMessage()}
          confirmLabel="Eliminar"
          variant="danger"
          loading={isDeleting || previewLoading}
          onConfirm={handleDelete}
          onCancel={() => {
            if (isDeleting) return;
            setDeleteTarget(null);
            setDeletePreview(null);
          }}
        />
      }
    </div>
  );
}
