"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { assignStudent } from "@/actions/user";

interface User {
  id: string;
  name: string;
}

interface AssignStudentFormProps {
  teachers: User[];
  students: User[];
}

export function AssignStudentForm({ teachers, students }: AssignStudentFormProps) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleTeacher(id: string) {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (selectedTeacherIds.length === 0) {
      setError("Seleccioná al menos un profe.");
      return;
    }

    startTransition(async () => {
      const results = await Promise.all(
        selectedTeacherIds.map((tid) => assignStudent(tid, studentId))
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length === results.length) {
        setError(
          failed[0] && !failed[0].success ? failed[0].error : "Error al asignar."
        );
      } else if (failed.length > 0) {
        setSuccessMsg(
          `${results.length - failed.length} asignados, ${failed.length} fallaron (ya existían).`
        );
        setSelectedTeacherIds([]);
      } else {
        setSuccessMsg(
          `${results.length} ${results.length === 1 ? "profe asignado" : "profes asignados"} correctamente.`
        );
        setSelectedTeacherIds([]);
      }
    });
  }

  if (teachers.length === 0 || students.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-500 text-xs font-heading uppercase tracking-[0.15em] font-bold">
          Necesitas al menos un profe y un alumno para asignar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Alumno
          </label>
          <select
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setSelectedTeacherIds([]);
              setError(null);
              setSuccessMsg(null);
            }}
            disabled={isPending}
            className="bg-[#1A1A1A] text-white font-body border border-[#2A2A2A] px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-[#E31414] focus:ring-1 focus:ring-[#E31414]/20 transition-all duration-200 disabled:opacity-50"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Profes ({selectedTeacherIds.length})
          </label>
          <div className="flex flex-wrap gap-2 bg-[#1A1A1A] border border-[#2A2A2A] p-3 max-h-48 overflow-y-auto">
            {teachers.map((t) => {
              const selected = selectedTeacherIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => toggleTeacher(t.id)}
                  className={[
                    "px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200 cursor-pointer",
                    selected
                      ? "border-[#E31414] text-white bg-[#E31414]/10"
                      : "border-[#2A2A2A] text-gray-400 hover:border-gray-500",
                  ].join(" ")}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs font-heading font-bold text-[#E31414] uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      {successMsg && (
        <p className="text-xs font-heading font-bold text-green-500 uppercase tracking-wide" role="status">
          {successMsg}
        </p>
      )}

      <Button
        type="submit"
        loading={isPending}
        size="md"
        disabled={selectedTeacherIds.length === 0}
      >
        Asignar {selectedTeacherIds.length > 0 ? `(${selectedTeacherIds.length})` : ""}
      </Button>
    </form>
  );
}
