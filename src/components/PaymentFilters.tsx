"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import type { PaymentMethod } from "@/lib/payment-stats";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  MERCADO_PAGO: "Mercado Pago",
};

const ALL_METHODS: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "MERCADO_PAGO",
];

interface Teacher {
  id: string;
  name: string;
}

interface Props {
  teachers: Teacher[];
  isAdmin: boolean;
  /** Currently active filter values (parsed from searchParams server-side) */
  current: {
    from: string;  // YYYY-MM-DD
    to: string;    // YYYY-MM-DD
    teacherIds: string[];
    methodIds: PaymentMethod[];
  };
}

export function PaymentFilters({ teachers, isAdmin, current }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function buildParams(overrides: Record<string, string | string[]>): string {
    const params = new URLSearchParams(searchParams.toString());
    // Remove stale params that are now replaced
    params.delete("statsMode");
    params.delete("statsMonth");
    params.delete("statsTeacherId");
    params.delete("statsStudentId");
    params.delete("statsTeacherIds");
    for (const [k, v] of Object.entries(overrides)) {
      if (Array.isArray(v)) {
        // Serialize as a single comma-separated string to avoid repeated keys
        const joined = v.filter(Boolean).join(",");
        if (joined) {
          params.set(k, joined);
        } else {
          params.delete(k);
        }
      } else if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
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

  function handleFromChange(date: string) {
    navigate({ statsFrom: date });
  }

  function handleToChange(date: string) {
    navigate({ statsTo: date });
  }

  function handleTeacherToggle(teacherId: string) {
    const next = current.teacherIds.includes(teacherId)
      ? current.teacherIds.filter((id) => id !== teacherId)
      : [...current.teacherIds, teacherId];
    navigate({ statsTeacherIds: next });
  }

  function handleClearTeachers() {
    navigate({ statsTeacherIds: [] });
  }

  function handleMethodToggle(method: PaymentMethod) {
    const next = current.methodIds.includes(method)
      ? current.methodIds.filter((m) => m !== method)
      : [...current.methodIds, method];
    navigate({ statsMethods: next });
  }

  function handleClearMethods() {
    navigate({ statsMethods: [] });
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Date range: Desde */}
      <div className="w-[150px]">
        <DatePicker
          label="Desde"
          value={current.from}
          onChange={handleFromChange}
        />
      </div>

      {/* Date range: Hasta */}
      <div className="w-[150px]">
        <DatePicker
          label="Hasta"
          value={current.to}
          onChange={handleToChange}
        />
      </div>

      {/* Teacher multi-select (ADMIN only) */}
      {isAdmin && teachers.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
            Profesor
          </span>
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              type="button"
              onClick={handleClearTeachers}
              className={[
                "px-3 text-[10px] font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200 cursor-pointer min-h-[44px]",
                current.teacherIds.length === 0
                  ? "bg-brand-red/15 border-brand-red/60 text-brand-red"
                  : "border-edge text-gray-500 hover:text-white hover:border-edge",
              ].join(" ")}
            >
              Todos
            </button>
            {teachers.map((t) => {
              const active = current.teacherIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTeacherToggle(t.id)}
                  className={[
                    "px-3 text-[10px] font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200 cursor-pointer min-h-[44px]",
                    active
                      ? "bg-brand-red/15 border-brand-red/60 text-brand-red"
                      : "border-edge text-gray-500 hover:text-white hover:border-edge",
                  ].join(" ")}
                  title={t.name}
                >
                  {t.name.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Method multi-select */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
          Método
        </span>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            type="button"
            onClick={handleClearMethods}
            className={[
              "px-3 text-[10px] font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200 cursor-pointer min-h-[44px]",
              current.methodIds.length === 0
                ? "bg-brand-red/15 border-brand-red/60 text-brand-red"
                : "border-edge text-gray-500 hover:text-white hover:border-edge",
            ].join(" ")}
          >
            Todos
          </button>
          {ALL_METHODS.map((m) => {
            const active = current.methodIds.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleMethodToggle(m)}
                className={[
                  "px-3 text-[10px] font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200 cursor-pointer min-h-[44px]",
                  active
                    ? "bg-brand-red/15 border-brand-red/60 text-brand-red"
                    : "border-edge text-gray-500 hover:text-white hover:border-edge",
                ].join(" ")}
              >
                {PAYMENT_METHOD_LABELS[m]}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
