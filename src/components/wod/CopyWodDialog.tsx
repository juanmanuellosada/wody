"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { TargetSelector } from "@/components/wod/TargetSelector";
import { copyWod } from "@/actions/wod";
import type { WodTarget } from "@/actions/wod";
import { toInputDate } from "@/lib/dates";
import type { WodTargetType } from "@prisma/client";
import type { GymTerms } from "@/lib/gym-terms";

interface GroupOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
}

interface SourceWod {
  id: string;
  date: Date;
  targetType: WodTargetType;
  targetGroupId?: string | null;
  targetStudentId?: string | null;
}

interface CopyWodDialogProps {
  sourceWod: SourceWod;
  groups: GroupOption[];
  students: StudentOption[];
  onClose: () => void;
  demo?: boolean;
  terms: GymTerms;
}

function sourceToTarget(wod: SourceWod): WodTarget {
  if (wod.targetType === "GROUP" && wod.targetGroupId) {
    return { type: "GROUP", groupId: wod.targetGroupId };
  }
  if (wod.targetType === "STUDENT" && wod.targetStudentId) {
    return { type: "STUDENT", studentId: wod.targetStudentId };
  }
  return { type: "ALL" };
}

function targetsEqual(a: WodTarget, b: WodTarget): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "GROUP" && b.type === "GROUP") return a.groupId === b.groupId;
  if (a.type === "STUDENT" && b.type === "STUDENT") return a.studentId === b.studentId;
  return true;
}

export function CopyWodDialog({
  sourceWod,
  groups,
  students,
  onClose,
  demo,
  terms,
}: CopyWodDialogProps) {
  const sourceDateStr = toInputDate(sourceWod.date);
  const sourceTarget = sourceToTarget(sourceWod);

  const [targetDate, setTargetDate] = useState(sourceDateStr);
  const [target, setTarget] = useState<WodTarget>(sourceTarget);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isSameAsSource =
    targetDate === sourceDateStr && targetsEqual(target, sourceTarget);

  function handleConfirm() {
    if (demo) {
      onClose();
      return;
    }

    setError(null);

    if (!targetDate) {
      setError("Selecciona una fecha.");
      return;
    }

    if (isSameAsSource) {
      setError("Cambia la fecha o el destinatario para copiar.");
      return;
    }

    startTransition(async () => {
      const result = await copyWod(sourceWod.id, targetDate, target);
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm bg-panel border border-line p-6 flex flex-col gap-5"
        role="dialog"
        aria-modal="true"
        aria-label={`Copiar ${terms.wod}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
            Copiar {terms.wod}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Cerrar"
          >
            &#215;
          </button>
        </div>

        <DatePicker
          label="Fecha destino"
          value={targetDate}
          onChange={setTargetDate}
          disabled={isPending}
        />

        <TargetSelector
          groups={groups}
          students={students}
          value={target}
          onChange={setTarget}
          disabled={isPending}
        />

        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            onClick={handleConfirm}
            disabled={isSameAsSource}
            className="flex-1"
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
