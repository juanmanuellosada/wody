"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

import wodyBlanco from "@/logos/wody-blanco.png";

const roleLinks = {
  admin: [
    { href: "/demo/admin", label: "Panel Admin" },
    { href: "/demo/admin/pagos", label: "Pagos" },
    { href: "/demo/teacher", label: "Dashboard Profe" },
    { href: "/demo/teacher/rms", label: "Mis RMs" },
  ],
  teacher: [
    { href: "/demo/teacher", label: "Mis WODs" },
    { href: "/demo/teacher/pagos", label: "Pagos" },
    { href: "/demo/teacher/rms", label: "Mis RMs" },
  ],
  student: [
    { href: "/demo/student", label: "Mi WOD" },
    { href: "/demo/student/rms", label: "Mis RMs" },
  ],
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  teacher: "Profe",
  student: "Alumno",
};

function detectRole(pathname: string): string {
  if (pathname.startsWith("/demo/admin")) return "admin";
  if (pathname.startsWith("/demo/teacher")) return "teacher";
  return "student";
}

export function DemoNavbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentRole = detectRole(pathname);
  const links = roleLinks[currentRole as keyof typeof roleLinks];
  const roleLabel = roleLabels[currentRole];

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <nav
      className="bg-black/95 backdrop-blur-sm border-b border-line sticky top-0 z-40"
      role="navigation"
      aria-label="Navegacion demo"
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/demo" className="flex items-center gap-2.5 group cursor-pointer">
          <Image src={wodyBlanco} alt="WODY" width={22} height={22} className="opacity-90 group-hover:opacity-100 transition-opacity duration-200" />
          <span className="w-px h-5 bg-edge" aria-hidden="true" />
          <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 group-hover:text-white transition-colors duration-200">
            Demo
          </span>
        </Link>

        {/* Desktop nav — role sections */}
        <div className="hidden sm:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 relative py-1",
                isActive(link.href)
                  ? "text-brand-red"
                  : "text-gray-400 hover:text-white",
              ].join(" ")}
            >
              {link.label}
              {isActive(link.href) && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red"
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </div>

        {/* Desktop — role switcher + exit */}
        <div className="hidden sm:flex items-center gap-3">
          {Object.entries(roleLabels).map(([role, label]) => (
            <Link
              key={role}
              href={`/demo/${role}`}
              className={[
                "text-xs font-heading font-bold uppercase tracking-[0.1em] px-2 py-1 border transition-colors duration-200",
                currentRole === role
                  ? "border-brand-red text-brand-red bg-brand-red/10"
                  : "border-edge text-gray-500 hover:border-gray-500 hover:text-white",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/"
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red transition-colors duration-200 ml-2 min-h-[44px] flex items-center"
          >
            Salir
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col justify-center gap-1.5 p-3 min-w-[44px] min-h-[44px] cursor-pointer"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
        >
          <span className={["block w-5 h-0.5 bg-white transition-all duration-200", menuOpen ? "translate-y-2 rotate-45" : ""].join(" ")} />
          <span className={["block w-5 h-0.5 bg-white transition-all duration-200", menuOpen ? "opacity-0" : ""].join(" ")} />
          <span className={["block w-5 h-0.5 bg-white transition-all duration-200", menuOpen ? "-translate-y-2 -rotate-45" : ""].join(" ")} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-black border-t border-line px-4 py-5 flex flex-col gap-4" role="menu">
          {/* Current role sections */}
          <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">
            Secciones — <span className="text-brand-red">{roleLabel}</span>
          </p>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={[
                "text-sm font-heading font-bold uppercase tracking-[0.15em] min-h-[44px] flex items-center",
                isActive(link.href) ? "text-brand-red" : "text-gray-300",
              ].join(" ")}
            >
              {isActive(link.href) && (
                <span className="w-1.5 h-1.5 bg-brand-red mr-3 flex-shrink-0" aria-hidden="true" />
              )}
              {link.label}
            </Link>
          ))}

          {/* Role switcher */}
          <div className="border-t border-line pt-4 mt-1">
            <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em] mb-3">
              Cambiar rol
            </p>
            <div className="flex gap-2">
              {Object.entries(roleLabels).map(([role, label]) => (
                <Link
                  key={role}
                  href={`/demo/${role}`}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "text-xs font-heading font-bold uppercase tracking-[0.1em] px-3 py-2 border transition-colors duration-200",
                    currentRole === role
                      ? "border-brand-red text-brand-red bg-brand-red/10"
                      : "border-edge text-gray-400",
                  ].join(" ")}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red text-left transition-colors duration-200 min-h-[44px] flex items-center"
          >
            Salir
          </Link>
        </div>
      )}
    </nav>
  );
}
