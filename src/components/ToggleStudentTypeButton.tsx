"use client";

import { useTransition } from "react";
import { toggleStudentType } from "@/actions/user";
import type { StudentType } from "@prisma/client";

interface Props {
  userId: string;
  currentType: StudentType;
}

export function ToggleStudentTypeButton({ userId, currentType }: Props) {
  const [isPending, startTransition] = useTransition();

  const label = currentType === "PERSONALIZED" ? "Personalizado" : "General";
  const isPersonalized = currentType === "PERSONALIZED";

  function handleClick() {
    startTransition(async () => {
      await toggleStudentType(userId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={`Cambiar a ${isPersonalized ? "General" : "Personalizado"}`}
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
  );
}
