"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { deactivateActivity } from "@/actions/activity";
import { gymPath } from "@/lib/gym";
import { ActivityDialog, type ActivityRow, type TeacherOption } from "@/components/activity/ActivityDialog";

interface Props {
  gymSlug: string;
  activities: ActivityRow[];
  teachers: TeacherOption[];
  canAssignTeacher: boolean;
}

export function ActivityList({ gymSlug, activities: initial, teachers, canAssignTeacher }: Props) {
  const [activities, setActivities] = useState(initial);
  const [editing, setEditing] = useState<ActivityRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDeactivate(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await deactivateActivity(id);
      if (!result.success) {
        setError(result.error);
      } else {
        setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, active: false } : a)));
      }
      setBusyId(null);
    });
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
                {a.color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: a.color }}
                    aria-hidden="true"
                  />
                )}
                <div>
                  <Link
                    href={gymPath(gymSlug, `/turnos/gestion/${a.id}`)}
                    className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
                  >
                    {a.name}
                  </Link>
                  <p className="text-gray-500 text-xs font-body">
                    {a.teacherName ?? "Sin profe asignado"}
                    {!a.active && <span className="ml-2 text-brand-red">· Desactivada</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                  Editar
                </Button>
                {a.active && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={isPending && busyId === a.id}
                    onClick={() => handleDeactivate(a.id)}
                  >
                    Desactivar
                  </Button>
                )}
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

      {editing && (
        <ActivityDialog
          activity={editing === "new" ? undefined : editing}
          teachers={teachers}
          canAssignTeacher={canAssignTeacher}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setActivities((prev) =>
              editing === "new" ? [...prev, saved] : prev.map((a) => (a.id === saved.id ? saved : a))
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
