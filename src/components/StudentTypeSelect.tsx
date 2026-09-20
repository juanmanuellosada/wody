"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { GymKind, StudentType } from "@prisma/client";
import { StudentTypeSelectView } from "@/components/StudentTypeSelectView";

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
    <StudentTypeSelectView
      gymKind={gymKind}
      value={value}
      label={label}
      onChange={handleChange}
    />
  );
}
