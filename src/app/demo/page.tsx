import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WODY — Demo",
  description: "Explorá cómo funciona WODY para cada rol.",
};

const roles = [
  {
    href: "/demo/admin",
    label: "Admin",
    description: "Gestión de usuarios, asignaciones y grupos de todos los profes.",
    color: "border-[#E31414] hover:bg-[#E31414]/10",
  },
  {
    href: "/demo/teacher",
    label: "Profe",
    description: "Creación de WODs, grupos de alumnos y gestión de rutinas.",
    color: "border-white/20 hover:bg-white/5",
  },
  {
    href: "/demo/student",
    label: "Alumno",
    description: "Vista del WOD de hoy, historial y búsqueda de rutinas.",
    color: "border-gray-600 hover:bg-gray-800/30",
  },
];

export default function DemoSelectorPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center px-6 py-20">
      <Link
        href="/"
        className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600 hover:text-[#E31414] transition-colors duration-200 mb-10"
      >
        &larr; Volver al inicio
      </Link>

      <h1 className="text-3xl sm:text-4xl font-heading font-black uppercase tracking-[0.1em] text-white mb-3 text-center">
        Demo de WODY
      </h1>
      <p className="text-sm text-gray-500 font-body mb-12 text-center max-w-md">
        Elegí un rol para ver cómo funciona la plataforma.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
        {roles.map((role) => (
          <Link
            key={role.href}
            href={role.href}
            className={[
              "border p-6 flex flex-col gap-3 transition-all duration-200 text-center group",
              role.color,
            ].join(" ")}
          >
            <h2 className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white group-hover:text-[#E31414] transition-colors duration-200">
              {role.label}
            </h2>
            <p className="text-xs text-gray-500 font-body leading-relaxed">
              {role.description}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
