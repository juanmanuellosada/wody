"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "bg-[#1A1A1A] text-white font-body",
            "border px-4 py-3 text-sm min-h-[44px]",
            "placeholder:text-gray-600",
            "focus:outline-none focus:border-[#E31414] focus:ring-1 focus:ring-[#E31414]/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-200",
            error ? "border-[#E31414]" : "border-[#2A2A2A]",
            className,
          ].join(" ")}
          {...props}
        />
        {error && (
          <p className="text-xs font-heading font-bold text-[#E31414] uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-gray-600 font-body">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
