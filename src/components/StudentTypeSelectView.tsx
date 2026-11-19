"use client";

import type { StudentType } from "@prisma/client";
import { STUDENT_TYPE_LABELS, studentTypeOptions } from "@/lib/student-type";

interface StudentTypeSelectViewProps {
  gymKind: Parameters<typeof studentTypeOptions>[0];
  value: StudentType | "";
  label?: string;
  onChange: (next: string) => void;
}

/** Presentation-only student type control. URL navigation belongs to its adapter. */
export function StudentTypeSelectView({
  gymKind,
  value,
  label = "Tipo de alumno",
  onChange,
}: StudentTypeSelectViewProps) {
  return (
    <div className="w-[180px]">
      <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-elev border border-edge text-white text-sm font-heading font-bold uppercase tracking-[0.08em] px-4 py-3 min-h-[44px] focus:outline-none focus:border-brand-red transition-colors duration-200 cursor-pointer"
      >
        <option value="">Todos los tipos</option>
        {studentTypeOptions(gymKind).map((opt) => (
          <option key={opt} value={opt}>
            {STUDENT_TYPE_LABELS[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}
