"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import wodyBlanco from "@/logos/wody-blanco.png";
import { useState } from "react";

const links = [
  { href: "/demo/admin", label: "Admin" },
  { href: "/demo/teacher", label: "Profe" },
  { href: "/demo/student", label: "Alumno" },
];

export function DemoNavbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentRole = links.find((l) => pathname.startsWith(l.href));
  const roleLabel = currentRole?.label ?? "Demo";

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="bg-black/95 backdrop-blur-sm border-b border-[#1A1A1A] sticky top-0 z-40"
      role="navigation"
      aria-label="Navegacion demo"
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/demo" className="flex items-center gap-2.5 group cursor-pointer">
          <Image src={wodyBlanco} alt="WODY" width={22} height={22} className="opacity-90 group-hover:opacity-100 transition-opacity duration-200" />
          <span className="w-px h-5 bg-[#2A2A2A]" aria-hidden="true" />
          <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 group-hover:text-white transition-colors duration-200">
            Demo
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 relative py-1",
                isActive(link.href)
                  ? "text-[#E31414]"
                  : "text-gray-400 hover:text-white",
              ].join(" ")}
            >
              {link.label}
              {isActive(link.href) && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E31414]"
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </div>

        {/* User info — desktop */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">
            Usuario Demo{" "}
            <span className="text-[#E31414]">({roleLabel})</span>
          </span>
          <Link
            href="/"
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-[#E31414] transition-colors duration-200 min-h-[44px] flex items-center"
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
        <div className="sm:hidden bg-black border-t border-[#1A1A1A] px-4 py-5 flex flex-col gap-4" role="menu">
          <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">
            Usuario Demo <span className="text-[#E31414]">({roleLabel})</span>
          </p>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={[
                "text-sm font-heading font-bold uppercase tracking-[0.15em] min-h-[44px] flex items-center",
                isActive(link.href) ? "text-[#E31414]" : "text-gray-300",
              ].join(" ")}
            >
              {isActive(link.href) && (
                <span className="w-1.5 h-1.5 bg-[#E31414] mr-3 flex-shrink-0" aria-hidden="true" />
              )}
              {link.label}
            </Link>
          ))}
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-[#E31414] text-left transition-colors duration-200 min-h-[44px] flex items-center"
          >
            Salir
          </Link>
        </div>
      )}
    </nav>
  );
}
