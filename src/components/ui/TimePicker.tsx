"use client";

import { useState, useRef, useEffect } from "react";

interface TimePickerProps {
  value: string; // HH:MM
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  /** Paso de minutos en el selector. Default 5. */
  step?: number;
}

function parseTime(str: string): { hour: number; minute: number } {
  const [h, m] = str.split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

function formatHM(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimePicker({ value, onChange, disabled = false, label, step = 5 }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const { hour, minute } = parseTime(value);
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60);

  // Close on outside click
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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Al abrir, centra la hora y el minuto seleccionados en sus columnas.
  useEffect(() => {
    if (!open) return;
    hourListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "center" });
    minuteListRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "center" });
  }, [open]);

  function selectHour(h: number) {
    onChange(formatHM(h, minute));
  }

  function selectMinute(m: number) {
    onChange(formatHM(hour, m));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={[
          "flex items-center justify-between gap-3 w-full",
          "bg-elev border px-4 py-3 text-sm min-h-[44px] font-heading font-bold",
          "transition-all duration-200 cursor-pointer text-left",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open
            ? "border-brand-red ring-1 ring-brand-red/20"
            : "border-edge hover:border-[#444444]",
        ].join(" ")}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-white uppercase tracking-[0.1em]">{formatHM(hour, minute)}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          className={[
            "text-gray-500 flex-shrink-0 transition-colors duration-200",
            open ? "text-brand-red" : "",
          ].join(" ")}
        >
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 14" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-[180px] bg-panel border border-line shadow-2xl shadow-black/50 flex divide-x divide-line">
          <div ref={hourListRef} className="flex-1 max-h-[220px] overflow-y-auto py-1">
            {HOURS.map((h) => {
              const isSelected = h === hour;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => selectHour(h)}
                  className={[
                    "w-full py-2 text-center text-xs font-heading font-bold transition-colors duration-150 cursor-pointer",
                    isSelected ? "bg-brand-red text-white" : "text-gray-300 hover:bg-elev hover:text-white",
                  ].join(" ")}
                  aria-label={`${h} horas`}
                  aria-pressed={isSelected}
                >
                  {String(h).padStart(2, "0")}
                </button>
              );
            })}
          </div>
          <div ref={minuteListRef} className="flex-1 max-h-[220px] overflow-y-auto py-1">
            {minutes.map((m) => {
              const isSelected = m === minute;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMinute(m)}
                  className={[
                    "w-full py-2 text-center text-xs font-heading font-bold transition-colors duration-150 cursor-pointer",
                    isSelected ? "bg-brand-red text-white" : "text-gray-300 hover:bg-elev hover:text-white",
                  ].join(" ")}
                  aria-label={`${m} minutos`}
                  aria-pressed={isSelected}
                >
                  {String(m).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
