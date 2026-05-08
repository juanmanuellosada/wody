"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { approveJoinRequest } from "@/actions/join-request";
import { formatDateArg, toInputDate } from "@/lib/dates";

interface TeacherOption {
  id: string;
  name: string;
}

interface Props {
  requestId: string;
  requestName: string;
  requestEmail: string;
  requestTeacherIds: string[];
  requestNextPaymentDate: Date;
  teachers: TeacherOption[];
}

export function ApproveJoinRequestButton({
  requestId,
  requestName,
  requestEmail,
  requestTeacherIds,
  requestNextPaymentDate,
  teachers,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Edit form state — defaults match the JoinRequest values.
  const [name, setName] = useState(requestName);
  const [studentType, setStudentType] = useState<"GENERAL" | "PERSONALIZED">("PERSONALIZED");
  const [teacherIds, setTeacherIds] = useState<string[]>(requestTeacherIds);
  const [canCreateOwnRoutines, setCanCreateOwnRoutines] = useState(false);
  const [nextPaymentDate, setNextPaymentDate] = useState(toInputDate(requestNextPaymentDate));

  // Compute "today" in Argentina (UTC-3) at render time for min attribute.
  const todayMin = (() => {
    const nowUTC = new Date();
    const argNow = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000);
    const y = argNow.getUTCFullYear();
    const m = String(argNow.getUTCMonth() + 1).padStart(2, "0");
    const d = String(argNow.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  // Replicate UserForm.tsx:32-36 visibility/forced logic.
  const showStudentExtras = studentType === "PERSONALIZED";
  const mustSelfManage = showStudentExtras && teacherIds.length === 0;
  const effectiveCanCreate = mustSelfManage ? true : canCreateOwnRoutines;

  function handleOpen() {
    // Reset edit form to current request defaults each time the modal opens.
    setName(requestName);
    setStudentType("PERSONALIZED");
    setTeacherIds(requestTeacherIds);
    setCanCreateOwnRoutines(false);
    setNextPaymentDate(toInputDate(requestNextPaymentDate));
    setEditOpen(false);
    setFeedback(null);
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      let result;
      if (editOpen) {
        // Build overrides only from fields the admin can change.
        const resolvedTeacherIds = showStudentExtras ? teacherIds : [];
        result = await approveJoinRequest({
          requestId,
          overrides: {
            name,
            studentType,
            teacherIds: resolvedTeacherIds,
            canCreateOwnRoutines: effectiveCanCreate,
            nextPaymentDate,
          },
        });
      } else {
        // Fast path: approve with request defaults.
        result = await approveJoinRequest({ requestId });
      }

      if (result.ok) {
        const finalName = editOpen ? name : requestName;
        toast.success(`Aprobada: ${finalName}`);
        setOpen(false);
        router.refresh();
      } else {
        setFeedback({ ok: false, msg: result.error });
      }
    });
  }

  function handleCancel() {
    if (!isPending) setOpen(false);
  }

  if (!open) {
    return (
      <>
        <Button variant="primary" size="sm" onClick={handleOpen} loading={isPending}>
          Aprobar
        </Button>
        {feedback && !feedback.ok && (
          <span
            className="text-xs font-heading font-bold uppercase tracking-wide px-2 py-1 text-brand-red"
            role="alert"
          >
            {feedback.msg}
          </span>
        )}
      </>
    );
  }

  return (
    <>
      {/* Modal overlay */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
        onClick={(e) => { if (e.target === e.currentTarget && !isPending) handleCancel(); }}
      >
        <div
          className="w-full max-w-sm bg-panel border border-line p-6 flex flex-col gap-5"
          role="dialog"
          aria-modal="true"
          aria-label="Aprobar solicitud"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              Aprobar solicitud
            </h2>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Cerrar"
            >
              &#215;
            </button>
          </div>

          {/* Request summary */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-heading font-bold text-white">{requestName}</p>
            {/* Email is always read-only and never part of the overrides payload. */}
            <p className="text-xs text-gray-400 font-body">{requestEmail}</p>
            {requestTeacherIds.length > 0 && !editOpen && (
              <p className="text-xs text-gray-500 font-heading">
                Profe{requestTeacherIds.length > 1 ? "s" : ""} elegido{requestTeacherIds.length > 1 ? "s" : ""}:{" "}
                {requestTeacherIds.map((id) => teachers.find((t) => t.id === id)?.name ?? id).join(", ")}
              </p>
            )}
            <p className="text-xs text-gray-500 font-heading">
              Próxima fecha de pago: {formatDateArg(requestNextPaymentDate)}
            </p>
          </div>

          {/* Edit panel */}
          {editOpen && (
            <div className="flex flex-col gap-4 border border-line p-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
                />
              </div>

              {/* Student type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
                  Tipo de alumno
                </label>
                <select
                  value={studentType}
                  onChange={(e) => setStudentType(e.target.value as "GENERAL" | "PERSONALIZED")}
                  disabled={isPending}
                  className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
                >
                  <option value="PERSONALIZED">Personalizado</option>
                  <option value="GENERAL">General</option>
                </select>
              </div>

              {/* Teacher checkboxes — only for PERSONALIZED */}
              {showStudentExtras && teachers.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
                    Profe (opcional)
                  </p>
                  <div className="flex flex-col gap-2">
                    {teachers.map((t) => (
                      <label key={t.id} className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={teacherIds.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTeacherIds((prev) => [...prev, t.id]);
                            } else {
                              setTeacherIds((prev) => prev.filter((id) => id !== t.id));
                            }
                          }}
                          disabled={isPending}
                          className="w-4 h-4 accent-brand-red cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="text-sm font-body text-white">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* canCreateOwnRoutines checkbox — only for PERSONALIZED */}
              {showStudentExtras && (
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={effectiveCanCreate}
                    disabled={isPending || mustSelfManage}
                    onChange={(e) => setCanCreateOwnRoutines(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand-red cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-heading font-bold text-white">
                      Puede crear sus propias rutinas
                    </span>
                    <span className="text-xs text-gray-500 font-body leading-snug">
                      {mustSelfManage
                        ? "Obligatorio al no asignar profe: el alumno se autogestiona."
                        : "El alumno va a poder crear rutinas asignadas a sí mismo."}
                    </span>
                  </span>
                </label>
              )}

              {/* Next payment date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
                  Próxima fecha de pago
                </label>
                <input
                  type="date"
                  name="nextPaymentDate"
                  value={nextPaymentDate}
                  min={todayMin}
                  onChange={(e) => setNextPaymentDate(e.target.value)}
                  required
                  disabled={isPending}
                  className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Error feedback (los success se muestran en toast global) */}
          {feedback && !feedback.ok && (
            <p
              className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
              role="alert"
            >
              {feedback.msg}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!editOpen && (
              <button
                onClick={() => setEditOpen(true)}
                disabled={isPending}
                className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                Editar antes de aprobar
              </button>
            )}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={isPending}
                onClick={handleConfirm}
                className="flex-1"
              >
                Aprobar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
