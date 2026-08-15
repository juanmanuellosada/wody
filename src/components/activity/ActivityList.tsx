"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { previewActivityDeletion, deleteActivity } from "@/actions/activity";
import { gymPath } from "@/lib/gym";
import { ActivityDialog, type ActivityRow, type TeacherOption } from "@/components/activity/ActivityDialog";
import { formatActivitySchedule } from "@/components/activity/format";

type SlotSummary = { dayOfWeek: number | null; date: string | null; startMinute: number; endMinute: number };

export type ActivityListRow = ActivityRow & { slots: SlotSummary[] };

interface Props {
  gymSlug: string;
  activities: ActivityListRow[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
}

export function ActivityList({ gymSlug, activities: initial, teachers, canAssignTeacher }: Props) {
  const [activities, setActivities] = useState(initial);
  const [editing, setEditing] = useState<ActivityRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
  const [deletePreview, setDeletePreview] = useState<{ willArchive: boolean; futureBookedStudents: number } | null>(
    null
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  async function openDeleteConfirm(a: ActivityRow) {
    setError(null);
    setResultMessage(null);
    setDeleteTarget(a);
    setDeletePreview(null);
    setPreviewLoading(true);
    const preview = await previewActivityDeletion(a.id);
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
      const result = await deleteActivity(target.id);
      setDeleteTarget(null);
      setDeletePreview(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setActivities((prev) => prev.filter((a) => a.id !== target.id));
      setResultMessage(
        result.mode === "deleted"
          ? `Se eliminó "${target.name}".`
          : `Se archivó "${target.name}" porque ya tenía alumnos anotados; el historial se conserva.`
      );
    });
  }

  function confirmMessage(): string {
    if (!deleteTarget) return "";
    if (previewLoading || !deletePreview) return "Calculando impacto...";
    if (deletePreview.willArchive) {
      const studentsNote =
        deletePreview.futureBookedStudents > 0
          ? ` ${deletePreview.futureBookedStudents} alumno(s) con reserva futura van a ser notificados.`
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
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic">Todavía no hay actividades cargadas.</p>
      ) : (
        <ul className="divide-y divide-line">
          {activities.map((a) => (
            <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div>
                  <Link
                    href={gymPath(gymSlug, `/turnos/gestion/${a.id}`)}
                    className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
                  >
                    {a.name}
                  </Link>
                  <p className="text-gray-500 text-xs font-body">{a.teacherName ?? "Sin profe asignado"}</p>
                  {formatActivitySchedule(a.scheduleKind, a.slots, a.startsOn, a.endsOn) && (
                    <p className="text-gray-500 text-xs font-body">
                      {formatActivitySchedule(a.scheduleKind, a.slots, a.startsOn, a.endsOn)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                  Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => openDeleteConfirm(a)}
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="px-4 py-2 border-t border-line text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
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
        <ActivityDialog
          activity={editing === "new" ? undefined : editing}
          teachers={teachers}
          canAssignTeacher={canAssignTeacher}
          onClose={() => setEditing(null)}
          onSaved={(saved, slots) => {
            setActivities((prev) =>
              editing === "new"
                ? [...prev, { ...saved, slots: slots ?? [] }]
                // La edición no toca horarios: se conservan los slots ya conocidos.
                : prev.map((a) => (a.id === saved.id ? { ...a, ...saved } : a))
            );
            setEditing(null);
          }}
        />
      )}

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
    </div>
  );
}
