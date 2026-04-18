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
    "bg-brand-red text-white hover:bg-brand-red-dark active:bg-brand-red-active disabled:opacity-50",
  secondary:
    "bg-elev text-white border border-edge hover:border-brand-red hover:text-brand-red disabled:opacity-50",
  ghost:
    "bg-transparent text-gray-400 hover:text-white hover:bg-elev disabled:opacity-50",
  danger:
    "bg-transparent text-brand-red border border-brand-red hover:bg-brand-red hover:text-white disabled:opacity-50",
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
        aria-busy={loading || undefined}
        className={[
          "relative inline-flex items-center justify-center gap-2",
          "font-heading font-bold uppercase tracking-[0.15em]",
          "transition-all duration-200 cursor-pointer",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red",
          "disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className,
        ].join(" ")}
        {...props}
      >
        {loading ? (
          <>
            {/* Invisible copy of children preserves the button's intrinsic
               width so it doesn't jump while loading. */}
            <span
              className="invisible inline-flex items-center gap-2"
              aria-hidden="true"
            >
              {children}
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center"
              aria-label="Cargando"
            >
              <span
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            </span>
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
