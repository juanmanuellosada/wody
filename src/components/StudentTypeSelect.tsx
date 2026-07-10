"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { GymKind, StudentType } from "@prisma/client";
import { STUDENT_TYPE_LABELS, studentTypeOptions } from "@/lib/student-type";

interface Props {
  gymKind: GymKind | null | undefined;
  /** Nombre del search param a leer/escribir (ej. "type"). */
  paramName: string;
  value: StudentType | "";
  label?: string;
}

/** Select de tipo de alumno que navega vía search param, preservando el resto de los filtros activos. */
export function StudentTypeSelect({ gymKind, paramName, value, label = "Tipo de alumno" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set(paramName, next);
    } else {
      params.delete(paramName);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="w-[180px]">
      <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
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
