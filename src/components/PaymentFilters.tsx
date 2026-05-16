"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DatePicker } from "@/components/ui/DatePicker";

interface Teacher {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
}

interface Props {
  teachers: Teacher[];
  students: Student[];
  isAdmin: boolean;
  /** Currently active filter values (parsed from searchParams server-side) */
  current: {
    mode: "month" | "range";
    month: string; // YYYY-MM
    from: string;  // YYYY-MM-DD
    to: string;    // YYYY-MM-DD
    teacherId: string;
    studentId: string;
  };
}

export function PaymentFilters({ teachers, students, isAdmin, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function buildParams(overrides: Record<string, string>): string {
    const params = new URLSearchParams(searchParams.toString());
    // Preserve existing non-stats params (e.g. status filter)
    for (const [k, v] of Object.entries(overrides)) {
      if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    }
    return params.toString();
  }

  function navigate(overrides: Record<string, string>) {
    const qs = buildParams(overrides);
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function handleModeChange(mode: "month" | "range") {
    if (mode === "month") {
      navigate({ statsMode: "month", statsFrom: "", statsTo: "" });
    } else {
      navigate({ statsMode: "range" });
    }
  }

  function handleMonthChange(month: string) {
    // month is YYYY-MM-DD from DatePicker (first day of month)
    const ym = month.slice(0, 7); // YYYY-MM
    navigate({ statsMode: "month", statsMonth: ym });
  }

  function handleFromChange(date: string) {
    navigate({ statsFrom: date });
  }

  function handleToChange(date: string) {
    navigate({ statsTo: date });
  }

  function handleTeacherChange(e: React.ChangeEvent<HTMLSelectElement>) {
    navigate({ statsTeacherId: e.target.value });
  }

  function handleStudentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    navigate({ statsStudentId: e.target.value });
  }

  // Convert YYYY-MM to a date string for the DatePicker (first day of month)
  const monthAsDate = current.month + "-01";

  const selectClass =
    "bg-elev border border-edge text-white text-xs font-heading font-bold px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 appearance-none min-h-[36px]";

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Period mode toggle */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
          Período
        </span>
        <div className="flex">
          <button
            type="button"
            onClick={() => handleModeChange("month")}
            className={[
              "px-3 py-1.5 text-[10px] font-heading font-bold uppercase tracking-[0.15em] border transition-colors duration-200 cursor-pointer",
              current.mode === "month"
                ? "bg-brand-red/15 border-brand-red/60 text-brand-red"
                : "border-edge text-gray-500 hover:text-white hover:border-edge",
            ].join(" ")}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("range")}
            className={[
              "px-3 py-1.5 text-[10px] font-heading font-bold uppercase tracking-[0.15em] border-t border-b border-r transition-colors duration-200 cursor-pointer",
              current.mode === "range"
                ? "bg-brand-red/15 border-brand-red/60 text-brand-red"
                : "border-edge text-gray-500 hover:text-white hover:border-edge",
            ].join(" ")}
          >
            Rango
          </button>
        </div>
      </div>

      {/* Month picker or range pickers */}
      {current.mode === "month" ? (
        <div className="w-[160px]">
          <DatePicker
            label="Mes"
            value={monthAsDate}
            onChange={handleMonthChange}
          />
        </div>
      ) : (
        <>
          <div className="w-[160px]">
            <DatePicker
              label="Desde"
              value={current.from}
              onChange={handleFromChange}
            />
          </div>
          <div className="w-[160px]">
            <DatePicker
              label="Hasta"
              value={current.to}
              onChange={handleToChange}
            />
          </div>
        </>
      )}

      {/* Teacher filter (ADMIN only) */}
      {isAdmin && teachers.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
            Profesor
          </span>
          <select
            value={current.teacherId}
            onChange={handleTeacherChange}
            className={selectClass}
          >
            <option value="">Todos</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Student filter */}
      {students.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
            Alumno
          </span>
          <select
            value={current.studentId}
            onChange={handleStudentChange}
            className={selectClass}
          >
            <option value="">Todos</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
