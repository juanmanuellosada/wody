"use client";

import { useState } from "react";
import { RmForm } from "@/components/RmForm";
import { DeleteRmButton } from "@/components/DeleteRmButton";
import { ShareRmButton } from "@/components/ShareRmButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toInputDate } from "@/lib/dates";

interface RmData {
  id: string;
  exercise: string;
  weight: number;
  date: string; // ISO string
  createdAt: string;
}

interface RmsClientProps {
  rms: RmData[];
  athleteName: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function RmsClient({ rms, athleteName }: RmsClientProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white mb-5">
          Mis RMs
        </h1>
        {editingId === null && <RmForm />}
      </section>

      <section>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Historial de RMs
          </h2>
          <div className="flex-1 h-px bg-[#1A1A1A]" aria-hidden="true" />
        </div>
        {rms.length === 0 ? (
          <p className="text-gray-600 text-sm font-heading font-bold uppercase tracking-[0.15em]">
            No tenes RMs registrados todavia.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rms.map((rm) =>
              editingId === rm.id ? (
                <RmForm
                  key={rm.id}
                  editId={rm.id}
                  defaultExercise={rm.exercise}
                  defaultWeight={rm.weight}
                  defaultDate={toInputDate(new Date(rm.date))}
                  onCancel={() => setEditingId(null)}
                  onSuccess={() => setEditingId(null)}
                />
              ) : (
                <Card key={rm.id}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-white font-heading font-bold uppercase tracking-[0.1em] text-sm truncate">
                        {rm.exercise}
                      </p>
                      <p className="text-[#E31414] font-heading font-black text-xl leading-none">
                        {rm.weight} <span className="text-sm text-gray-500">kg</span>
                      </p>
                      <p className="text-gray-600 text-xs font-heading uppercase tracking-[0.1em]">
                        {formatDate(rm.date)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <ShareRmButton
                        exercise={rm.exercise}
                        weight={rm.weight}
                        date={formatDate(rm.date)}
                        athleteName={athleteName}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingId(rm.id)}
                      >
                        Editar
                      </Button>
                      <DeleteRmButton rmId={rm.id} />
                    </div>
                  </div>
                </Card>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}
