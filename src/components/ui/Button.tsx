"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[#E31414] text-white hover:bg-[#B00F0F] active:bg-[#8B0B0B] disabled:opacity-50",
  secondary:
    "bg-[#1A1A1A] text-white border border-[#2A2A2A] hover:border-[#E31414] hover:text-[#E31414] disabled:opacity-50",
  ghost:
    "bg-transparent text-gray-400 hover:text-white hover:bg-[#1A1A1A] disabled:opacity-50",
  danger:
    "bg-transparent text-[#E31414] border border-[#E31414] hover:bg-[#E31414] hover:text-white disabled:opacity-50",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-xs min-h-[36px]",
  md: "px-6 py-3 text-sm min-h-[44px]",
  lg: "px-10 py-4 text-base min-h-[48px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2",
          "font-heading font-bold uppercase tracking-[0.15em]",
          "transition-all duration-200 cursor-pointer",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E31414]",
          "disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className,
        ].join(" ")}
        {...props}
      >
        {loading ? (
          <>
            <span
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span>Cargando...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
