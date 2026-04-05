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
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await assignStudent(teacherId, studentId);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
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
            Profe
          </label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={isPending}
            className="bg-[#1A1A1A] text-white font-body border border-[#2A2A2A] px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-[#E31414] focus:ring-1 focus:ring-[#E31414]/20 transition-all duration-200 disabled:opacity-50"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Alumno
          </label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
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
      </div>

      {error && (
        <p className="text-xs font-heading font-bold text-[#E31414] uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="text-xs font-heading font-bold text-green-500 uppercase tracking-wide" role="status">
          Alumno asignado correctamente.
        </p>
      )}

      <Button type="submit" loading={isPending} size="md">
        Asignar
      </Button>
    </form>
  );
}
