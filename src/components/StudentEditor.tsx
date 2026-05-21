"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  updateStudent,
  assignStudent,
  unassignStudent,
  setUserBlocked,
  setCanCreateOwnRoutines,
  setStudentPaymentExempt,
} from "@/actions/user";
import { setStudentPaymentDate } from "@/actions/payment";
import { toInputDate } from "@/lib/dates";
import type { AccountKind, StudentType } from "@prisma/client";

interface TeacherOption {
  id: string;
  name: string;
}

interface StudentEditorProps {
  studentId: string;
  currentName: string;
  currentEmail: string | null;
  accountKind?: AccountKind;
  currentPaymentDate?: Date;
  currentBlocked?: boolean;
  currentStudentType: StudentType;
  currentCanCreateOwnRoutines: boolean;
  currentPaymentExempt: boolean;
  currentPaymentExemptReason: string | null;
  assignedTeachers: TeacherOption[];
  allTeachers: TeacherOption[];
  isAdmin: boolean;
  onClose: () => void;
  demo?: boolean;
}

export function StudentEditor({
  studentId,
  currentName,
  currentEmail,
  accountKind,
  currentPaymentDate,
  currentBlocked = false,
  currentStudentType,
  currentCanCreateOwnRoutines,
  currentPaymentExempt,
  currentPaymentExemptReason,
  assignedTeachers,
  allTeachers,
  isAdmin,
  onClose,
  demo,
}: StudentEditorProps) {
  const isLite = accountKind === "LITE";
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [password, setPassword] = useState("");
  const [blocked, setBlocked] = useState(currentBlocked);
  const [canCreate, setCanCreate] = useState(currentCanCreateOwnRoutines);
  const currentPaymentDateStr = currentPaymentDate
    ? toInputDate(currentPaymentDate)
    : "";
  const [paymentDate, setPaymentDate] = useState(currentPaymentDateStr);
  const [paymentExempt, setPaymentExempt] = useState(currentPaymentExempt);
  const [paymentExemptReason, setPaymentExemptReason] = useState(currentPaymentExemptReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [addTeacherId, setAddTeacherId] = useState("");

  const showCanCreateToggle = currentStudentType === "PERSONALIZED";
  // Sin profe asignado el alumno tiene que autogestionarse: bloqueamos el toggle en true.
  const canCreateLocked = assignedTeachers.length === 0;

  const availableTeachers = allTeachers.filter(
    (t) => !assignedTeachers.some((at) => at.id === t.id)
  );

  function handleSave() {
    setError(null);
    const data: { name?: string; email?: string; password?: string } = {};
    if (name.trim() !== currentName) data.name = name;
    if (!isLite && email.trim() !== (currentEmail ?? "")) data.email = email;
    if (!isLite && password.trim()) data.password = password;

    const paymentChanged =
      currentPaymentDate !== undefined &&
      paymentDate !== currentPaymentDateStr;

    if (Object.keys(data).length === 0 && !paymentChanged) {
      onClose();
      return;
    }
    if (demo) {
      onClose();
      return;
    }

    startTransition(async () => {
      if (Object.keys(data).length > 0) {
        const result = await updateStudent(studentId, data);
        if (!result.success) {
          setError(result.error);
          return;
        }
      }
      if (paymentChanged) {
        const result = await setStudentPaymentDate(studentId, paymentDate);
        if (!result.success) {
          setError("error" in result ? result.error : "Error al actualizar la fecha.");
          return;
        }
      }
      onClose();
    });
  }

  function handleAddTeacher() {
    if (!addTeacherId || demo) return;
    setError(null);
    startTransition(async () => {
      const result = await assignStudent(addTeacherId, studentId);
      if (result.success) {
        setAddTeacherId("");
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemoveTeacher(teacherId: string) {
    if (demo) return;
    setError(null);
    startTransition(async () => {
      const result = await unassignStudent(teacherId, studentId);
      if (!result.success) setError(result.error);
    });
  }

  function handleTogglePaymentExempt() {
    if (demo) return;
    setError(null);
    const next = !paymentExempt;
    const reason = paymentExemptReason.trim() || null;
    startTransition(async () => {
      const result = await setStudentPaymentExempt(studentId, next, reason);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPaymentExempt(next);
    });
  }

  function handleToggleBlocked() {
    if (demo) return;
    setError(null);
    const next = !blocked;
    startTransition(async () => {
      const result = await setUserBlocked(studentId, next);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBlocked(next);
    });
  }

  function handleToggleCanCreate() {
    if (demo || canCreateLocked) return;
    setError(null);
    const next = !canCreate;
    startTransition(async () => {
      const result = await setCanCreateOwnRoutines(studentId, next);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCanCreate(next);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Editar Alumno
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>
          {isLite ? (
            <p className="text-xs text-amber-400/80 font-body leading-snug border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              Alumno lite — sin email ni contraseña. Usá &quot;Convertir a cuenta completa&quot; para asignarle acceso a la app.
            </p>
          ) : (
            <>
              <div>
                <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                  className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
                />
              </div>
              <div>
                <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Dejar vacío para no cambiar"
                  disabled={isPending}
                  className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-brand-red transition-colors duration-200"
                />
              </div>
            </>
          )}
          {currentPaymentDate && (
            <DatePicker
              value={paymentDate}
              onChange={setPaymentDate}
              disabled={isPending}
              label="Próximo pago"
            />
          )}
        </div>

        {/* Teachers */}
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 block">
            Profes asignados
          </label>
          {assignedTeachers.length === 0 ? (
            <p className="text-xs text-gray-600 font-body italic">
              Sin profes asignados
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignedTeachers.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-elev border border-edge text-xs font-heading font-bold text-gray-300"
                >
                  {t.name}
                  <button
                    onClick={() => handleRemoveTeacher(t.id)}
                    disabled={isPending}
                    className="text-gray-600 hover:text-brand-red transition-colors duration-200 cursor-pointer"
                    title="Quitar profe"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {availableTeachers.length > 0 && (
            <div className="flex gap-2 items-center mt-1">
              <select
                value={addTeacherId}
                onChange={(e) => setAddTeacherId(e.target.value)}
                disabled={isPending}
                className="flex-1 bg-elev border border-edge text-gray-300 text-xs font-body px-2 py-1.5 focus:outline-none focus:border-brand-red transition-colors duration-200"
              >
                <option value="">Agregar profe...</option>
                {availableTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddTeacher}
                disabled={isPending || !addTeacherId}
              >
                Agregar
              </Button>
            </div>
          )}
        </div>

        {/* Self-service routines */}
        {showCanCreateToggle && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 block">
              Rutinas propias
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 font-body leading-snug max-w-[16rem]">
                {canCreateLocked
                  ? "Sin profe asignado: el alumno se autogestiona."
                  : canCreate
                  ? "Puede crearse sus propias rutinas."
                  : "No puede crearse rutinas."}
              </p>
              <Button
                variant={canCreate ? "danger" : "primary"}
                size="sm"
                onClick={handleToggleCanCreate}
                disabled={isPending || canCreateLocked}
              >
                {canCreate ? "Desactivar" : "Activar"}
              </Button>
            </div>
          </div>
        )}

        {/* Exento de pago — solo ADMIN */}
        {isAdmin && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 block">
              Exento de pago
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 font-body">
                {paymentExempt
                  ? "No se le cobra cuota. No aparece en mora ni recibe recordatorios."
                  : "Se rige por su próxima fecha de pago."}
              </p>
              <Button
                variant={paymentExempt ? "danger" : "primary"}
                size="sm"
                onClick={handleTogglePaymentExempt}
                disabled={isPending}
              >
                {paymentExempt ? "Quitar exención" : "Marcar exento"}
              </Button>
            </div>
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Motivo (opcional)
              </label>
              <textarea
                value={paymentExemptReason}
                onChange={(e) => setPaymentExemptReason(e.target.value)}
                disabled={isPending}
                placeholder="Ej: Hijo del dueño, staff, becado..."
                rows={2}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600 resize-none"
              />
              <p className="text-[10px] text-gray-600 font-body mt-1">
                El motivo se guarda al marcar o quitar la exención.
              </p>
            </div>
          </div>
        )}

        {/* Block / unblock */}
        {!demo && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 block">
              Acceso
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 font-body">
                {blocked
                  ? "Bloqueado: no puede ingresar a la app."
                  : "Activo: puede ingresar a la app."}
              </p>
              <Button
                variant={blocked ? "primary" : "danger"}
                size="sm"
                onClick={handleToggleBlocked}
                disabled={isPending}
              >
                {blocked ? "Desbloquear" : "Bloquear"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={isPending}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
