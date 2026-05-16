"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";
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

/** Minimal multi-select dropdown — no external lib, matches DatePicker trigger sizing. */
function MultiSelectDropdown<T extends string>({
  label,
  options,
  getLabel,
  selected,
  onToggle,
  onClear,
  triggerWidth,
}: {
  label: string;
  options: T[];
  getLabel: (v: T) => string;
  selected: T[];
  onToggle: (v: T) => void;
  onClear: () => void;
  triggerWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Build trigger label
  let triggerLabel: string;
  if (selected.length === 0) {
    triggerLabel = `Todos los ${label.toLowerCase()}es`;
    if (label === "Método") triggerLabel = "Todos los métodos";
    if (label === "Profesor") triggerLabel = "Todos los profesores";
  } else if (selected.length === 1) {
    triggerLabel = getLabel(selected[0]);
  } else {
    triggerLabel = `${selected.length} seleccionados`;
  }

  const hasSelection = selected.length > 0;

  return (
    <div ref={containerRef} className={`relative ${triggerWidth ?? "w-[180px]"}`}>
      <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center justify-between gap-2 w-full",
          "bg-elev border px-4 py-3 text-sm min-h-[44px] font-heading font-bold",
          "transition-all duration-200 cursor-pointer text-left",
          open
            ? "border-brand-red ring-1 ring-brand-red/20"
            : hasSelection
            ? "border-brand-red/60 hover:border-brand-red/80"
            : "border-edge hover:border-[#444444]",
        ].join(" ")}
      >
        <span
          className={[
            "truncate uppercase tracking-[0.08em] text-[11px]",
            hasSelection ? "text-brand-red" : "text-gray-400",
          ].join(" ")}
        >
          {triggerLabel}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          className={[
            "flex-shrink-0 transition-colors duration-200",
            open ? "text-brand-red rotate-180" : "text-gray-500",
          ].join(" ")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-full w-max bg-panel border border-line shadow-2xl shadow-black/50">
          {/* "Todos" reset option */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className={[
              "flex items-center gap-2 w-full px-3 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer border-b border-line",
              selected.length === 0
                ? "text-brand-red bg-brand-red/10"
                : "text-gray-400 hover:text-white hover:bg-elev",
            ].join(" ")}
          >
            <span
              className={[
                "w-3.5 h-3.5 flex-shrink-0 border flex items-center justify-center",
                selected.length === 0 ? "border-brand-red bg-brand-red/20" : "border-gray-600",
              ].join(" ")}
            >
              {selected.length === 0 && (
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </span>
            Todos
          </button>

          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onToggle(opt)}
                className={[
                  "flex items-center gap-2 w-full px-3 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer",
                  checked
                    ? "text-brand-red bg-brand-red/10"
                    : "text-gray-400 hover:text-white hover:bg-elev",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-3.5 h-3.5 flex-shrink-0 border flex items-center justify-center",
                    checked ? "border-brand-red bg-brand-red/20" : "border-gray-600",
                  ].join(" ")}
                >
                  {checked && (
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                      <polyline points="2 6 5 9 10 3" />
                    </svg>
                  )}
                </span>
                {getLabel(opt)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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

      {/* Teacher multi-select dropdown (ADMIN only) */}
      {isAdmin && teachers.length > 0 && (
        <MultiSelectDropdown
          label="Profesor"
          options={teachers.map((t) => t.id)}
          getLabel={(id) => teachers.find((t) => t.id === id)?.name ?? id}
          selected={current.teacherIds}
          onToggle={handleTeacherToggle}
          onClear={handleClearTeachers}
          triggerWidth="w-[180px]"
        />
      )}

      {/* Method multi-select dropdown */}
      <MultiSelectDropdown
        label="Método"
        options={ALL_METHODS}
        getLabel={(m) => PAYMENT_METHOD_LABELS[m]}
        selected={current.methodIds}
        onToggle={handleMethodToggle}
        onClear={handleClearMethods}
        triggerWidth="w-[180px]"
      />
    </div>
  );
}
