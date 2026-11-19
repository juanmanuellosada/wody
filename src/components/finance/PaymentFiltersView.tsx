"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import type { PaymentFiltersViewProps, RevenuePaymentMethod } from "./revenue-view-contracts";

const PAYMENT_METHOD_LABELS: Record<RevenuePaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  MERCADO_PAGO: "Mercado Pago",
};

const ALL_METHODS: RevenuePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];

const STUDENT_TYPE_LABELS: Record<Exclude<PaymentFiltersViewProps["current"]["studentType"], "">, string> = {
  GENERAL: "General",
  PERSONALIZED: "Personalizado",
  MUSCULACION_LIBRE: "Musculación libre",
};

function studentTypeOptions(gymKind: PaymentFiltersViewProps["gymKind"]) {
  return gymKind === "GYM"
    ? (["GENERAL", "PERSONALIZED", "MUSCULACION_LIBRE"] as const)
    : (["GENERAL", "PERSONALIZED"] as const);
}

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
  getLabel: (value: T) => string;
  selected: T[];
  onToggle: (value: T) => void;
  onClear: () => void;
  triggerWidth?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

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
      <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
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
        <span className={["truncate uppercase tracking-[0.08em] text-[11px]", hasSelection ? "text-brand-red" : "text-gray-400"].join(" ")}>
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
          className={["flex-shrink-0 transition-colors duration-200", open ? "text-brand-red rotate-180" : "text-gray-500"].join(" ")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-full w-max bg-panel border border-line shadow-2xl shadow-black/50">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className={[
              "flex items-center gap-2 w-full px-3 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer border-b border-line",
              selected.length === 0 ? "text-brand-red bg-brand-red/10" : "text-gray-400 hover:text-white hover:bg-elev",
            ].join(" ")}
          >
            <span className={["w-3.5 h-3.5 flex-shrink-0 border flex items-center justify-center", selected.length === 0 ? "border-brand-red bg-brand-red/20" : "border-gray-600"].join(" ")}>
              {selected.length === 0 && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><polyline points="2 6 5 9 10 3" /></svg>}
            </span>
            Todos
          </button>

          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onToggle(option)}
                className={[
                  "flex items-center gap-2 w-full px-3 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer",
                  checked ? "text-brand-red bg-brand-red/10" : "text-gray-400 hover:text-white hover:bg-elev",
                ].join(" ")}
              >
                <span className={["w-3.5 h-3.5 flex-shrink-0 border flex items-center justify-center", checked ? "border-brand-red bg-brand-red/20" : "border-gray-600"].join(" ")}>
                  {checked && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><polyline points="2 6 5 9 10 3" /></svg>}
                </span>
                {getLabel(option)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PaymentFiltersView({
  teachers,
  isAdmin,
  gymKind,
  current,
  onFromChange,
  onToChange,
  onTeacherToggle,
  onClearTeachers,
  onMethodToggle,
  onClearMethods,
  onStudentTypeChange,
}: PaymentFiltersViewProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="w-[150px]"><DatePicker label="Desde" value={current.from} onChange={onFromChange} /></div>
      <div className="w-[150px]"><DatePicker label="Hasta" value={current.to} onChange={onToChange} /></div>

      {isAdmin && teachers.length > 0 && (
        <MultiSelectDropdown
          label="Profesor"
          options={teachers.map((teacher) => teacher.id)}
          getLabel={(id) => teachers.find((teacher) => teacher.id === id)?.name ?? id}
          selected={current.teacherIds}
          onToggle={onTeacherToggle}
          onClear={onClearTeachers}
          triggerWidth="w-[180px]"
        />
      )}

      <MultiSelectDropdown
        label="Método"
        options={ALL_METHODS}
        getLabel={(method) => PAYMENT_METHOD_LABELS[method]}
        selected={current.methodIds}
        onToggle={onMethodToggle}
        onClear={onClearMethods}
        triggerWidth="w-[180px]"
      />

      <div className="w-[180px]">
        <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">Tipo de alumno</label>
        <select
          value={current.studentType}
          onChange={(event) => onStudentTypeChange(event.target.value as PaymentFiltersViewProps["current"]["studentType"])}
          className="w-full bg-elev border border-edge text-white text-sm font-heading font-bold uppercase tracking-[0.08em] px-4 py-3 min-h-[44px] focus:outline-none focus:border-brand-red transition-colors duration-200 cursor-pointer"
        >
          <option value="">Todos los tipos</option>
          {studentTypeOptions(gymKind).map((option) => <option key={option} value={option}>{STUDENT_TYPE_LABELS[option]}</option>)}
        </select>
      </div>
    </div>
  );
}
