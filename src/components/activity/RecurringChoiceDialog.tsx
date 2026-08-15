"use client";

import { Button } from "@/components/ui/Button";

interface Props {
  open: boolean;
  activityName: string;
  /** Ej: "los Lunes". */
  dayLabel: string;
  loading: boolean;
  onChooseSingle: () => void;
  onChooseAll: () => void;
  onCancel: () => void;
}

/** Pregunta "¿a todas o solo a esta?" — solo se ofrece si Activity.allowsRecurring es true. */
export function RecurringChoiceDialog({
  open,
  activityName,
  dayLabel,
  loading,
  onChooseSingle,
  onChooseAll,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <div
        className="w-full max-w-sm bg-panel border border-line p-6 flex flex-col gap-4"
        role="dialog"
        aria-modal="true"
        aria-label="¿Cómo querés anotarte?"
      >
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          ¿Cómo querés anotarte?
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          {activityName} tiene horario fijo {dayLabel}. Podés anotarte solo a esta fecha, o quedar inscripto a todas.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="sm" onClick={onChooseAll} loading={loading} disabled={loading}>
            Anotarme a todas
          </Button>
          <Button variant="secondary" size="sm" onClick={onChooseSingle} loading={loading} disabled={loading}>
            Solo esta fecha
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
