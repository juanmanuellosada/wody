"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { AlertCircle, RotateCcw } from "lucide-react";
import { createFixedRoutine, updateFixedRoutine, deleteFixedRoutine } from "@/actions/fixed-routine";
import { toInputDate, getTodayArgentina, formatDateArg } from "@/lib/dates";

const MarkdownEditor = dynamic(
  () => import("@/components/ui/MarkdownEditor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="h-[220px] bg-elev border border-edge animate-pulse" /> }
);

interface StudentOption {
  id: string;
  name: string;
}

interface RenewalRoutine {
  id: string;
  studentId: string;
  studentName: string;
  renewAt: Date;
  overdue: boolean;
}

interface FixedRoutineManagerProps {
  muslibStudents: StudentOption[];  // students with MUSCULACION_LIBRE type
  renewalRoutines: RenewalRoutine[]; // teacher's routines due within 7 days
}

function defaultRenewAt(): string {
  const today = getTodayArgentina();
  const plus30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  return toInputDate(plus30);
}

type FormMode = "closed" | "create" | "edit";

interface FormState {
  mode: FormMode;
  studentId?: string;
  routineId?: string;
  title: string;
  content: string;
  renewAt: string;
}

export function FixedRoutineManager({
  muslibStudents,
  renewalRoutines,
}: FixedRoutineManagerProps) {
  const [form, setForm] = useState<FormState>({
    mode: "closed",
    title: "",
    content: "",
    renewAt: defaultRenewAt(),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (muslibStudents.length === 0 && renewalRoutines.length === 0) {
    return null;
  }

  function openCreate(studentId: string) {
    setFormError(null);
    setForm({ mode: "create", studentId, title: "", content: "", renewAt: defaultRenewAt() });
  }

  function closeForm() {
    setForm({ mode: "closed", title: "", content: "", renewAt: defaultRenewAt() });
    setFormError(null);
  }

  function handleSubmit() {
    setFormError(null);
    startTransition(async () => {
      let result;
      if (form.mode === "create" && form.studentId) {
        result = await createFixedRoutine(form.studentId, form.title, form.content, form.renewAt);
      } else if (form.mode === "edit" && form.routineId) {
        result = await updateFixedRoutine(form.routineId, form.title, form.content, form.renewAt);
      } else {
        return;
      }
      if (!result.success) {
        setFormError(result.error);
      } else {
        closeForm();
      }
    });
  }

  function handleDelete(routineId: string) {
    startTransition(async () => {
      await deleteFixedRoutine(routineId);
    });
  }

  const isFormOpen = form.mode !== "closed";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Rutinas Fijas
        </h2>
        <div className="flex-1 h-px bg-elev" aria-hidden="true" />
      </div>

      {/* Renewal indicator */}
      {renewalRoutines.length > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-amber-400">
              Rutinas por renovar
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {renewalRoutines.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white font-body font-medium">{r.studentName}</span>
                  <span className={[
                    "text-[10px] font-heading font-bold uppercase tracking-[0.1em] px-1.5 py-0.5",
                    r.overdue
                      ? "bg-brand-red/20 text-brand-red"
                      : "bg-amber-500/20 text-amber-400",
                  ].join(" ")}>
                    {r.overdue ? "Vencida" : `Vence ${formatDateArg(r.renewAt)}`}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openCreate(r.studentId)}
                  disabled={isPending}
                >
                  <RotateCcw size={12} className="mr-1" aria-hidden="true" />
                  Renovar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student list with assign/renew actions */}
      {muslibStudents.length > 0 && (
        <div className="flex flex-col gap-1">
          {muslibStudents.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 border border-edge bg-panel px-4 py-3"
            >
              <span className="text-sm text-white font-body">{s.name}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openCreate(s.id)}
                disabled={isPending}
              >
                Asignar / Renovar
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={(e) => e.target === e.currentTarget && !isPending && closeForm()}
        >
          <div className="bg-panel border border-edge p-6 w-full max-w-lg mx-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              {form.mode === "create" ? "Asignar / Renovar Rutina" : "Editar Rutina"}
            </h3>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Título (ej: Nivel A — Fuerza)
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                disabled={isPending}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Contenido
              </label>
              <MarkdownEditor
                value={form.content}
                onChange={(v) => setForm((f) => ({ ...f, content: v }))}
                disabled={isPending}
                placeholder="Describí los ejercicios, series y repeticiones..."
              />
            </div>

            <DatePicker
              label="Renovar el"
              value={form.renewAt}
              onChange={(v) => setForm((f) => ({ ...f, renewAt: v }))}
              disabled={isPending}
            />

            {formError && (
              <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
                {formError}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={closeForm} disabled={isPending}>
                Cancelar
              </Button>
              {form.mode === "edit" && form.routineId && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { handleDelete(form.routineId!); closeForm(); }}
                  disabled={isPending}
                >
                  Eliminar
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={handleSubmit} loading={isPending}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
