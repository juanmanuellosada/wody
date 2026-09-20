"use client";

import Link from "next/link";
import type { TrainingActor, TrainingRole } from "./training-demo-types";

type DemoTrainingActorSelectorProps = {
  routeRole: TrainingRole;
  selectedActor: TrainingActor;
  actors: TrainingActor[];
  onSelectActor: (actorId: string) => void;
  onReset: () => void;
};

const roleHomes: Record<Lowercase<TrainingRole>, string> = {
  admin: "/demo/admin",
  teacher: "/demo/teacher",
  student: "/demo/student",
};

const roleLabels: Record<TrainingRole, string> = {
  ADMIN: "Administración",
  TEACHER: "Profesorado",
  STUDENT: "Alumno",
};

/** Keeps the selected local identity compatible with the current role route. */
export function DemoTrainingActorSelector({
  routeRole,
  selectedActor,
  actors,
  onSelectActor,
  onReset,
}: DemoTrainingActorSelectorProps) {
  const roleActors = actors.filter((actor) => actor.role === routeRole);

  return (
    <section className="border border-line bg-panel p-4 flex flex-col gap-4" aria-labelledby="demo-training-identity">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">BOX de demostración</p>
        <h2 id="demo-training-identity" className="mt-1 text-lg font-heading font-bold uppercase tracking-[0.12em] text-white">
          Identidad ficticia
        </h2>
        <p className="mt-1 text-sm font-body text-gray-400">
          Estás viendo la demo como {selectedActor.name} · {roleLabels[selectedActor.role]}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Identidad de entrenamiento">
        {roleActors.map((actor) => (
          <button
            key={actor.id}
            type="button"
            className={`min-h-[36px] border px-3 text-xs font-heading font-bold uppercase tracking-[0.12em] transition-colors ${
              selectedActor.id === actor.id
                ? "border-brand-red bg-brand-red text-white"
                : "border-edge bg-elev text-gray-300 hover:border-brand-red hover:text-brand-red"
            }`}
            aria-pressed={selectedActor.id === actor.id}
            onClick={() => onSelectActor(actor.id)}
          >
            {actor.name}
          </button>
        ))}
        <button
          type="button"
          className="min-h-[36px] border border-edge bg-elev px-3 text-xs font-heading font-bold uppercase tracking-[0.12em] text-gray-300 hover:border-brand-red hover:text-brand-red"
          onClick={onReset}
        >
          Restablecer demo
        </button>
      </div>

      <nav className="flex flex-wrap gap-2 border-t border-line pt-4" aria-label="Cambiar rol de demostración">
        {(Object.entries(roleHomes) as Array<[Lowercase<TrainingRole>, string]>).map(([role, href]) => {
          const roleName = role.toUpperCase() as TrainingRole;
          return (
            <Link
              key={role}
              href={href}
              className={`border px-3 py-2 text-xs font-heading font-bold uppercase tracking-[0.12em] transition-colors ${
                routeRole === roleName
                  ? "border-brand-red text-brand-red bg-brand-red/10"
                  : "border-edge text-gray-400 hover:border-gray-500 hover:text-white"
              }`}
            >
              {roleLabels[roleName]}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
