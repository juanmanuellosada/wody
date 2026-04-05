"use client";

import { useState, useTransition, useEffect } from "react";
import { toggleStudentType } from "@/actions/user";
import { Button } from "@/components/ui/Button";
import type { StudentType } from "@prisma/client";

interface Props {
  userId: string;
  currentType: StudentType;
}

export function ToggleStudentTypeButton({ userId, currentType }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);

  const label = currentType === "PERSONALIZED" ? "Personalizado" : "General";
  const isPersonalized = currentType === "PERSONALIZED";
  const newTypeLabel = isPersonalized ? "General" : "Personalizado";

  function handleConfirm() {
    startTransition(async () => {
      await toggleStudentType(userId);
      setShowModal(false);
    });
  }

  // Close on Escape
  useEffect(() => {
    if (!showModal) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowModal(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showModal]);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={isPending}
        title={`Cambiar a ${newTypeLabel}`}
        className={[
          "text-[10px] font-heading font-bold uppercase tracking-[0.15em] px-2.5 py-1 cursor-pointer transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isPersonalized
            ? "bg-green-900/20 text-green-400 border border-green-800/30 hover:bg-green-900/40"
            : "bg-yellow-900/20 text-yellow-400 border border-yellow-800/30 hover:bg-yellow-900/40",
        ].join(" ")}
      >
        {isPending ? "..." : label}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="bg-[#0A0A0A] border border-[#2A2A2A] p-6 sm:p-8 max-w-sm w-full">
            <p className="text-sm font-heading font-black uppercase tracking-[0.1em] text-white mb-4">
              Cambiar tipo de alumno
            </p>
            <p className="text-sm text-gray-400 font-body mb-6 leading-relaxed">
              {"Vas a cambiar este alumno de "}
              <span className={isPersonalized ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>
                {label}
              </span>
              {" a "}
              <span className={isPersonalized ? "text-yellow-400 font-bold" : "text-green-400 font-bold"}>
                {newTypeLabel}
              </span>
              {isPersonalized
                ? ". Va a perder acceso a los WODs."
                : ". Va a poder ver los WODs de su profe."}
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowModal(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                loading={isPending}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
