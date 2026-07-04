"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface GymBillingOverdueModalProps {
  gymId: string;
  gymSlug: string;
  daysOverdue: number;
}

function dismissKey(gymId: string) {
  return `wody:billing-overdue-dismissed:${gymId}`;
}

export function GymBillingOverdueModal({ gymId, gymSlug, daysOverdue }: GymBillingOverdueModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(dismissKey(gymId)) === "1") return;
    } catch {
      // sessionStorage no disponible (ej. modo privado) — mostramos igual
    }
    setOpen(true);
  }, [gymId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    try {
      sessionStorage.setItem(dismissKey(gymId), "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  const dayLabel = daysOverdue === 1 ? "1 día" : `${daysOverdue} días`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cuota vencida"
    >
      <div className="w-full max-w-sm bg-panel border border-brand-red/40 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-brand-red">
            Tu cuota de Wody está vencida
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Cerrar"
          >
            &#215;
          </button>
        </div>

        <p className="text-sm text-gray-300 leading-relaxed">
          Tu cuota está vencida hace {dayLabel}. Regularizá el pago para seguir usando Wody con
          normalidad.
        </p>

        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={handleClose} className="flex-1">
            Cerrar
          </Button>
          <Link
            href={`/${gymSlug}/admin/billing`}
            onClick={handleClose}
            className="flex-1 inline-flex items-center justify-center gap-2 font-heading font-bold uppercase tracking-[0.15em] transition-all duration-200 cursor-pointer bg-brand-red text-white hover:bg-brand-red-dark active:bg-brand-red-active px-4 py-2 text-xs min-h-[36px]"
          >
            Ir a facturación
          </Link>
        </div>
      </div>
    </div>
  );
}
