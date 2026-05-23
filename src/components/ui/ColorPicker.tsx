"use client";

import { useState, useRef, useEffect } from "react";

const PRESETS = [
  "#E31414", // rojo de marca
  "#E05500", // naranja oscuro
  "#E88A00", // amarillo/ámbar
  "#16A34A", // verde
  "#0891B2", // cyan
  "#2563EB", // azul
  "#7C3AED", // violeta
  "#BE185D", // fucsia
  "#6B7280", // gris
  "#1E293B", // slate oscuro
  "#FFFFFF", // blanco
  "#000000", // negro
];

interface ColorPickerProps {
  value: string; // hex con #
  onChange: (value: string) => void;
  label?: string;
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync hex input when value changes externally
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setHexInput(value);
  }

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

  function handleHexInput(raw: string) {
    setHexInput(raw);
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    if (isValidHex(normalized)) {
      onChange(normalized.toUpperCase());
    }
  }

  function handlePreset(color: string) {
    onChange(color);
    setHexInput(color);
    setOpen(false);
  }

  const displayColor = isValidHex(value) ? value : "#E31414";

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          "flex items-center gap-3 w-full",
          "bg-elev border px-4 py-3 text-sm min-h-[44px] font-heading font-bold",
          "transition-all duration-200 cursor-pointer text-left",
          open
            ? "border-brand-red ring-1 ring-brand-red/20"
            : "border-edge hover:border-[#444444]",
        ].join(" ")}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span
          className="w-6 h-6 flex-shrink-0 border border-white/10"
          style={{ backgroundColor: displayColor }}
          aria-hidden="true"
        />
        <span className="text-white uppercase tracking-[0.1em] text-sm font-heading font-bold">
          {value.toUpperCase()}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-[220px] bg-panel border border-line shadow-2xl shadow-black/50 p-3 flex flex-col gap-3">
          {/* Preset grid */}
          <div className="grid grid-cols-6 gap-1.5">
            {PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handlePreset(color)}
                title={color}
                className={[
                  "w-8 h-8 border transition-all duration-150 cursor-pointer",
                  value.toUpperCase() === color.toUpperCase()
                    ? "border-brand-red ring-1 ring-brand-red/40 scale-110"
                    : "border-white/10 hover:border-white/40 hover:scale-105",
                ].join(" ")}
                style={{ backgroundColor: color }}
                aria-label={color}
                aria-pressed={value.toUpperCase() === color.toUpperCase()}
              />
            ))}
          </div>

          {/* Hex input */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
              Hex custom
            </label>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInput(e.target.value)}
              placeholder="#E31414"
              maxLength={7}
              className="bg-elev text-white font-body w-full border border-edge px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200"
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
