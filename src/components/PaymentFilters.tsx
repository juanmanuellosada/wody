"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PaymentFiltersView } from "@/components/finance/PaymentFiltersView";
import type { PaymentMethod } from "@/lib/payment-stats";
import type { GymKind, StudentType } from "@prisma/client";

interface Teacher {
  id: string;
  name: string;
}

interface Props {
  teachers: Teacher[];
  isAdmin: boolean;
  gymKind: GymKind | null | undefined;
  /** Currently active filter values (parsed from searchParams server-side) */
  current: {
    from: string;
    to: string;
    teacherIds: string[];
    methodIds: PaymentMethod[];
    studentType: StudentType | "";
  };
}

/** Production URL adapter for the controlled payment-filter presentation. */
export function PaymentFilters({ teachers, isAdmin, gymKind, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function buildParams(overrides: Record<string, string | string[]>): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("statsMode");
    params.delete("statsMonth");
    params.delete("statsTeacherId");
    params.delete("statsStudentId");
    params.delete("statsTeacherIds");
    for (const [key, value] of Object.entries(overrides)) {
      if (Array.isArray(value)) {
        const joined = value.filter(Boolean).join(",");
        if (joined) params.set(key, joined);
        else params.delete(key);
      } else if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    return params.toString();
  }

  function navigate(overrides: Record<string, string | string[]>) {
    const qs = buildParams(overrides);
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleTeacherToggle(teacherId: string) {
    const next = current.teacherIds.includes(teacherId)
      ? current.teacherIds.filter((id) => id !== teacherId)
      : [...current.teacherIds, teacherId];
    navigate({ statsTeacherIds: next });
  }

  function handleMethodToggle(method: PaymentMethod) {
    const next = current.methodIds.includes(method)
      ? current.methodIds.filter((candidate) => candidate !== method)
      : [...current.methodIds, method];
    navigate({ statsMethods: next });
  }

  return (
    <PaymentFiltersView
      teachers={teachers}
      isAdmin={isAdmin}
      gymKind={gymKind}
      current={current}
      onFromChange={(date) => navigate({ statsFrom: date })}
      onToChange={(date) => navigate({ statsTo: date })}
      onTeacherToggle={handleTeacherToggle}
      onClearTeachers={() => navigate({ statsTeacherIds: [] })}
      onMethodToggle={handleMethodToggle}
      onClearMethods={() => navigate({ statsMethods: [] })}
      onStudentTypeChange={(studentType) => navigate({ statsStudentType: studentType })}
    />
  );
}
