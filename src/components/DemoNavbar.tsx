"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

import wodyBlanco from "@/logos/wody-blanco.png";

const roleLinks = {
  admin: [
    { href: "/demo/admin", label: "Panel Admin" },
    { href: "/demo/admin/pagos", label: "Cuotas" },
    { href: "/demo/admin/caja", label: "Caja" },
    { href: "/demo/admin/productos", label: "Productos" },
    { href: "/demo/admin/ingresos", label: "Ingresos" },
    { href: "/demo/admin/turnos", label: "Turnos" },
    { href: "/demo/admin/rms", label: "Mis RMs" },
    { href: "/demo/teacher", label: "Dashboard Profe" },
    { href: "/demo/teacher/rms", label: "Mis RMs" },
  ],
  teacher: [
    { href: "/demo/teacher", label: "Mis WODs" },
    { href: "/demo/teacher/pagos", label: "Cuotas" },
    { href: "/demo/teacher/caja", label: "Caja" },
    { href: "/demo/teacher/rms", label: "Mis RMs" },
    { href: "/demo/teacher/turnos", label: "Turnos" },
  ],
  student: [
    { href: "/demo/student", label: "Mi WOD" },
    { href: "/demo/student/rms", label: "Mis RMs" },
    { href: "/demo/student/beneficios", label: "Beneficios" },
    { href: "/demo/student/turnos", label: "Turnos" },
  ],
};

const gymRoleLinks = {
  admin: [{ href: "/demo/gym/admin", label: "Entrenamiento" }, { href: "/demo/gym/admin/rms", label: "Mis PRs" }],
  teacher: [{ href: "/demo/gym/teacher", label: "Mis rutinas" }, { href: "/demo/gym/teacher/rms", label: "Mis PRs" }],
  student: [{ href: "/demo/gym/student", label: "Mi rutina" }, { href: "/demo/gym/student/rms", label: "Mis PRs" }],
};

const personalLinks = [
  { href: "/demo/personal/student", label: "Mis rutinas" },
  { href: "/demo/personal/student/rms", label: "Mis PRs" },
  { href: "/demo/personal/student/suscripcion", label: "Suscripción" },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  teacher: "Profe",
  student: "Alumno",
};

function detectRole(pathname: string): string {
  if (pathname.startsWith("/demo/gym/admin") || pathname.startsWith("/demo/admin")) return "admin";
  if (pathname.startsWith("/demo/gym/teacher") || pathname.startsWith("/demo/teacher")) return "teacher";
  return "student";
}

export function DemoNavbar({ supportedRoutes, scenario }: { supportedRoutes?: string[]; scenario?: "PERSONAL" | "GYM" }) {
  const pathname = usePathname() ?? "";
  const [menuOpen, setMenuOpen] = useState(false);
  const isGym = scenario === "GYM" || pathname === "/demo/gym" || pathname.startsWith("/demo/gym/");
  const isPersonal = scenario === "PERSONAL" || pathname === "/demo/personal" || pathname.startsWith("/demo/personal/");

  if (pathname === "/demo" || pathname === "/demo/") return null;
  // Preview owns its existing global navbar. The GYM provider renders the scoped one.
  if (isGym && scenario !== "GYM") return null;

  const currentRole = detectRole(pathname);
  const boxLinks = roleLinks[currentRole as keyof typeof roleLinks].filter(
    (link) => !supportedRoutes || supportedRoutes.includes(link.href),
  );
  const links = isGym ? gymRoleLinks[currentRole as keyof typeof gymRoleLinks] : isPersonal
    ? personalLinks.filter((link) => !supportedRoutes || supportedRoutes.includes(link.href))
    : boxLinks;
  const roleLabel = isGym ? "Gimnasio" : isPersonal ? "Personal" : roleLabels[currentRole];

  function isActive(href: string) {
    return pathname === href || (
      href === "/demo/admin/ingresos"
      && pathname.startsWith("/demo/admin/ingresos/")
    );
  }

  return (
    <nav
      className="bg-black/95 backdrop-blur-sm border-b border-line sticky top-0 z-40"
      role="navigation"
      aria-label="Navegacion demo"
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/demo" className="flex items-center gap-2.5 group cursor-pointer">
          <Image src={wodyBlanco} alt="WODY" width={22} height={22} className="opacity-90 group-hover:opacity-100 transition-opacity duration-200" unoptimized />
          <span className="w-px h-5 bg-edge" aria-hidden="true" />
          <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 group-hover:text-white transition-colors duration-200">Demo</span>
        </Link>

        <div className="hidden sm:flex items-center gap-6">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={[
              "text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 relative py-1",
              isActive(link.href) ? "text-brand-red" : "text-gray-400 hover:text-white",
            ].join(" ")}>
              {link.label}
              {isActive(link.href) && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red" aria-hidden="true" />}
            </Link>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-3">
          {isPersonal ? (
            <Link href="/demo" className="text-xs font-heading font-bold uppercase tracking-[0.1em] px-2 py-1 border border-edge text-gray-500 hover:border-gray-500 hover:text-white transition-colors duration-200">
              Volver al BOX
            </Link>
          ) : (
            Object.entries(roleLabels).map(([role, label]) => (
              <Link key={role} href={isGym ? `/demo/gym/${role}` : `/demo/${role}`} className={[
                "text-xs font-heading font-bold uppercase tracking-[0.1em] px-2 py-1 border transition-colors duration-200",
                currentRole === role ? "border-brand-red text-brand-red bg-brand-red/10" : "border-edge text-gray-500 hover:border-gray-500 hover:text-white",
              ].join(" ")}>
                {label}
              </Link>
            ))
          )}
          <Link href="/" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red transition-colors duration-200 ml-2 min-h-[44px] flex items-center">Salir</Link>
        </div>

        <button className="sm:hidden flex flex-col justify-center gap-1.5 p-3 min-w-[44px] min-h-[44px] cursor-pointer" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"} aria-expanded={menuOpen}>
          <span className={["block w-5 h-0.5 bg-white transition-all duration-200", menuOpen ? "translate-y-2 rotate-45" : ""].join(" ")} />
          <span className={["block w-5 h-0.5 bg-white transition-all duration-200", menuOpen ? "opacity-0" : ""].join(" ")} />
          <span className={["block w-5 h-0.5 bg-white transition-all duration-200", menuOpen ? "-translate-y-2 -rotate-45" : ""].join(" ")} />
        </button>
      </div>

      {menuOpen && (
        <div className="sm:hidden bg-black border-t border-line px-4 py-5 flex flex-col gap-4" role="menu">
          <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">Secciones — <span className="text-brand-red">{roleLabel}</span></p>
          {links.map((link) => (
            <Link key={link.href} href={link.href} role="menuitem" onClick={() => setMenuOpen(false)} className={[
              "text-sm font-heading font-bold uppercase tracking-[0.15em] min-h-[44px] flex items-center",
              isActive(link.href) ? "text-brand-red" : "text-gray-300",
            ].join(" ")}>
              {isActive(link.href) && <span className="w-1.5 h-1.5 bg-brand-red mr-3 flex-shrink-0" aria-hidden="true" />}
              {link.label}
            </Link>
          ))}

          {isPersonal ? (
            <Link href="/demo" onClick={() => setMenuOpen(false)} className="border-t border-line pt-4 mt-1 text-sm font-heading font-bold uppercase tracking-[0.15em] min-h-[44px] flex items-center text-gray-300">
              Volver al BOX
            </Link>
          ) : (
            <div className="border-t border-line pt-4 mt-1">
              <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em] mb-3">Cambiar rol</p>
              <div className="flex gap-2">
                {Object.entries(roleLabels).map(([role, label]) => (
                  <Link key={role} href={isGym ? `/demo/gym/${role}` : `/demo/${role}`} onClick={() => setMenuOpen(false)} className={[
                    "text-xs font-heading font-bold uppercase tracking-[0.1em] px-3 py-2 border transition-colors duration-200",
                    currentRole === role ? "border-brand-red text-brand-red bg-brand-red/10" : "border-edge text-gray-400",
                  ].join(" ")}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Link href="/" onClick={() => setMenuOpen(false)} className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red text-left transition-colors duration-200 min-h-[44px] flex items-center">Salir</Link>
        </div>
      )}
    </nav>
  );
}
