"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const PERCENTAGES = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

const mockRms = [
  { id: "rm1", exercise: "Back Squat", weight: 120, date: "10/04/2025" },
  { id: "rm2", exercise: "Deadlift", weight: 150, date: "08/04/2025" },
  { id: "rm3", exercise: "Bench Press", weight: 85, date: "05/04/2025" },
  { id: "rm4", exercise: "Clean & Jerk", weight: 95, date: "03/04/2025" },
  { id: "rm5", exercise: "Snatch", weight: 70, date: "01/04/2025" },
];

export function DemoRms() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white mb-5">
          Mis RMs
        </h1>
        {/* Disabled form */}
        <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-5 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input disabled placeholder="Ejercicio" className="bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed" />
            <input disabled placeholder="Peso (kg)" type="number" className="bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed" />
            <input disabled placeholder="Fecha" type="date" className="bg-[#1A1A1A] border border-[#2A2A2A] text-gray-600 text-sm font-body px-3 py-2 cursor-not-allowed" />
          </div>
          <Button variant="primary" size="sm" disabled className="self-start">
            Guardar RM
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-4 mb-5">
          <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Historial de RMs
          </h2>
          <div className="flex-1 h-px bg-[#1A1A1A]" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-3">
          {mockRms.map((rm) => (
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
                    {rm.date}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expandedId === rm.id ? null : rm.id)}
                  >
                    {expandedId === rm.id ? "Ocultar %" : "Ver %"}
                  </Button>
                  <Button variant="ghost" size="sm" disabled>
                    Compartir
                  </Button>
                  <Button variant="secondary" size="sm" disabled>
                    Editar
                  </Button>
                  <Button variant="danger" size="sm" disabled>
                    Eliminar
                  </Button>
                </div>
              </div>

              {expandedId === rm.id && (
                <div className="mt-4 pt-4 border-t border-[#2A2A2A]">
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {PERCENTAGES.map((pct) => {
                      const value = Math.round(rm.weight * pct) / 100;
                      return (
                        <div
                          key={pct}
                          className="bg-[#0A0A0A] border border-[#2A2A2A] py-2 px-1 text-center"
                        >
                          <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-gray-500">
                            {pct}%
                          </p>
                          <p className="text-sm font-heading font-black text-white leading-tight">
                            {value}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
