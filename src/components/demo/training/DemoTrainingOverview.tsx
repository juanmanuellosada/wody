"use client";

import Link from "next/link";

const modules = [
  { href: "/demo/admin", label: "Administración", description: "Gestioná WODs y grupos con identidad de administración." },
  { href: "/demo/teacher", label: "Profesorado", description: "Creá, editá, copiá y asigná WODs a tus alumnos." },
  { href: "/demo/student", label: "Alumno", description: "Consultá WODs visibles, su detalle y tu historial." },
  { href: "/demo/student/rms", label: "RMs", description: "Registrá y compartí récords ficticios por identidad." },
  { href: "/demo/student/turnos", label: "Turnos", description: "Probá el módulo de reservas local ya disponible." },
  { href: "/demo/student/beneficios", label: "Beneficios", description: "Revisá beneficios de demostración no canjeables." },
  { href: "/demo/admin/pagos", label: "Cuotas", description: "Consultá cuotas ficticias como administración o profesorado." },
  { href: "/demo/admin/caja", label: "Caja", description: "Registrá cuotas ficticias en la caja de demostración." },
];

/** Shared entry hub used by both demo applications. */
export function DemoTrainingOverview() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center px-6 py-20">
      <Link
        href="/"
        className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600 hover:text-brand-red transition-colors duration-200 mb-10"
      >
        &larr; Volver al inicio
      </Link>
      <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-3">BOX de demostración</p>
      <h1 className="text-3xl sm:text-4xl font-heading font-black uppercase tracking-[0.1em] text-white mb-3 text-center">
        Demo funcional de WODY
      </h1>
      <p className="text-sm text-gray-500 font-body mb-12 text-center max-w-xl">
        Elegí un rol o módulo. Todo usa datos ficticios guardados solo durante esta navegación.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="border border-white/20 p-6 flex flex-col gap-3 transition-all duration-200 text-center group hover:bg-white/5 hover:border-brand-red"
          >
            <h2 className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white group-hover:text-brand-red transition-colors duration-200">
              {module.label}
            </h2>
            <p className="text-xs text-gray-500 font-body leading-relaxed">{module.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
