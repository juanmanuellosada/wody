"use client";

import { useState, useRef, useEffect } from "react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

const DAYS_SHORT = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseDate(str: string): { year: number; month: number; day: number } {
  const [y, m, d] = str.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function formatYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplay(str: string): string {
  const { year, month, day } = parseDate(str);
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0=Sun, convert to Mon=0
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export function DatePicker({ value, onChange, disabled = false, label }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const { year, month } = parseDate(value);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Sync view when value changes externally
  useEffect(() => {
    const { year: y, month: m } = parseDate(value);
    setViewYear(y);
    setViewMonth(m);
  }, [value]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function selectDay(day: number) {
    onChange(formatYMD(viewYear, viewMonth, day));
    setOpen(false);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const selectedParsed = parseDate(value);
  const isSelectedMonth = selectedParsed.year === viewYear && selectedParsed.month === viewMonth;

  // Today for highlighting
  const now = new Date();
  const todayStr = formatYMD(now.getFullYear(), now.getMonth(), now.getDate());
  const isTodayMonth = now.getFullYear() === viewYear && now.getMonth() === viewMonth;

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
          "bg-[#1A1A1A] border px-4 py-3 text-sm min-h-[44px] font-heading font-bold",
          "transition-all duration-200 cursor-pointer text-left",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open
            ? "border-brand-red ring-1 ring-brand-red/20"
            : "border-[#2A2A2A] hover:border-[#444444]",
        ].join(" ")}
      >
        <span className="text-white uppercase tracking-[0.1em]">
          {formatDisplay(value)}
        </span>
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
          <rect x="3" y="4" width="18" height="18" rx="0" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-[280px] bg-[#0A0A0A] border border-[#1A1A1A] shadow-2xl shadow-black/50">
          {/* Month/Year nav */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1A1A1A]">
            <button
              type="button"
              onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1A1A1A] transition-colors duration-200 cursor-pointer"
              aria-label="Mes anterior"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1A1A1A] transition-colors duration-200 cursor-pointer"
              aria-label="Mes siguiente"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DAYS_SHORT.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-heading font-bold uppercase tracking-wider text-gray-600 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 px-2 pb-2">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = isSelectedMonth && selectedParsed.day === day;
              const isToday = isTodayMonth && now.getDate() === day;
              const dateStr = formatYMD(viewYear, viewMonth, day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={[
                    "h-8 flex items-center justify-center text-xs font-heading font-bold cursor-pointer transition-all duration-150",
                    isSelected
                      ? "bg-brand-red text-white"
                      : isToday
                      ? "text-brand-red border border-brand-red/30"
                      : "text-gray-300 hover:bg-[#1A1A1A] hover:text-white",
                  ].join(" ")}
                  aria-label={`${day} de ${MONTHS[viewMonth]} ${viewYear}`}
                  aria-pressed={isSelected}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="border-t border-[#1A1A1A] px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onChange(todayStr);
                setOpen(false);
              }}
              className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red transition-colors duration-200 cursor-pointer"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
