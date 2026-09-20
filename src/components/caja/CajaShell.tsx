import type { ReactNode } from "react";

export interface CajaShellProps {
  quotaAction?: ReactNode;
  saleAction?: ReactNode;
  expenseAction?: ReactNode;
  children?: ReactNode;
}

/** Server-safe Caja presentation; pages retain their own authorization and data boundaries. */
export function CajaShell({ quotaAction, saleAction, expenseAction, children }: CajaShellProps) {
  return (
    <div className="flex flex-col gap-10">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
              Recaudación y pagos
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Caja
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {saleAction}
            {expenseAction}
            {quotaAction}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
