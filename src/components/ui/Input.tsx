"use client";

import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, className = "", id, type, showPasswordToggle, ...props },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === "password";
    const toggleEnabled = isPassword && showPasswordToggle;
    const effectiveType = toggleEnabled && revealed ? "text" : type;

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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            className={[
              "bg-elev text-white font-body w-full",
              "border px-4 py-3 text-sm min-h-[44px]",
              toggleEnabled ? "pr-12" : "",
              "placeholder:text-gray-600",
              "focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-200",
              error ? "border-brand-red" : "border-edge",
              className,
            ].join(" ")}
            {...props}
          />
          {toggleEnabled && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              disabled={props.disabled}
              aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={revealed}
              className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-gray-400 hover:text-white focus:outline-none focus-visible:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              tabIndex={-1}
            >
              {revealed ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
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
