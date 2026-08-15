import Link from "next/link";
import { gymPath } from "@/lib/gym";

interface Props {
  gymSlug: string;
  active: "calendario" | "mis-turnos";
}

/** Navegación entre el calendario de turnos y "Mis turnos" del alumno. */
export function TurnosTabs({ gymSlug, active }: Props) {
  const tabs = [
    { key: "calendario" as const, href: gymPath(gymSlug, "/turnos"), label: "Calendario" },
    { key: "mis-turnos" as const, href: gymPath(gymSlug, "/turnos/mis-turnos"), label: "Mis turnos" },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-4 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] border transition-colors duration-200 ${
            active === tab.key
              ? "border-brand-red text-brand-red"
              : "border-edge text-gray-400 hover:text-white hover:border-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
