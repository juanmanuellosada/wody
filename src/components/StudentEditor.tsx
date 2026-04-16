"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { updateStudent, assignStudent, unassignStudent } from "@/actions/user";

interface TeacherOption {
  id: string;
  name: string;
}

interface StudentEditorProps {
  studentId: string;
  currentName: string;
  currentEmail: string;
  assignedTeachers: TeacherOption[];
  allTeachers: TeacherOption[];
  onClose: () => void;
  demo?: boolean;
}

export function StudentEditor({
  studentId,
  currentName,
  currentEmail,
  assignedTeachers,
  allTeachers,
  onClose,
  demo,
}: StudentEditorProps) {
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [addTeacherId, setAddTeacherId] = useState("");

  const availableTeachers = allTeachers.filter(
    (t) => !assignedTeachers.some((at) => at.id === t.id)
  );

  function handleSave() {
    setError(null);
    const data: { name?: string; email?: string; password?: string } = {};
    if (name.trim() !== currentName) data.name = name;
    if (email.trim() !== currentEmail) data.email = email;
    if (password.trim()) data.password = password;

    if (Object.keys(data).length === 0 || demo) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await updateStudent(studentId, data);
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0A0A0A] border border-[#2A2A2A] p-6 w-full max-w-md mx-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
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
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
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
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>
        </div>

        {/* Teachers */}
        <div className="flex flex-col gap-2 border-t border-[#1A1A1A] pt-4">
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1A1A1A] border border-[#2A2A2A] text-xs font-heading font-bold text-gray-300"
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
                className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] text-gray-300 text-xs font-body px-2 py-1.5 focus:outline-none focus:border-brand-red transition-colors duration-200"
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
