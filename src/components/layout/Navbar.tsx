"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Role, StudentType } from "@prisma/client";
import { gymPath } from "@/lib/gym";

import wodyBlanco from "@/logos/wody-blanco.png";
import unidosTexto from "@/logos/unidos-texto.png";
import rompiendoHorizontal from "@/logos/rompiendo-limites-horizontal.png";

const GYM_NAV_LOGOS: Record<string, { src: typeof unidosTexto; alt: string }> = {
  "unidos-garage": { src: unidosTexto, alt: "Unidos Garage" },
  "rompiendo-limites": { src: rompiendoHorizontal, alt: "Rompiendo Limites" },
};

interface NavbarProps {
  userName: string;
  role: Role;
  studentType?: StudentType;
  gymSlug: string;
  onSignOut: () => void;
}

function getNavLinks(role: Role, gymSlug: string, studentType?: StudentType) {
  if (role === "ADMIN") {
    return [
      { href: gymPath(gymSlug, "/admin"), label: "Panel Admin" },
      { href: gymPath(gymSlug, "/dashboard/teacher"), label: "Dashboard Profe" },
      { href: gymPath(gymSlug, "/dashboard/rms"), label: "Mis RMs" },
      { href: gymPath(gymSlug, "/dashboard/timers"), label: "Cronómetros" },
    ];
  }
  if (role === "TEACHER") {
    return [
      { href: gymPath(gymSlug, "/dashboard/teacher"), label: "Mis WODs" },
      { href: gymPath(gymSlug, "/dashboard/rms"), label: "Mis RMs" },
      { href: gymPath(gymSlug, "/dashboard/timers"), label: "Cronómetros" },
    ];
  }
  return [
    { href: gymPath(gymSlug, "/dashboard/athlete"), label: "Mi WOD" },
    { href: gymPath(gymSlug, "/dashboard/rms"), label: "Mis RMs" },
    { href: gymPath(gymSlug, "/dashboard/timers"), label: "Cronómetros" },
  ];
}

export function Navbar({ userName, role, studentType, gymSlug, onSignOut }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const links = getNavLinks(role, gymSlug, studentType);

  const roleLabel =
    role === "ADMIN" ? "Admin" : role === "TEACHER" ? "Profe" : "Atleta";

  function isActive(href: string) {
    return pathname === href;
  }

  const gymLogo = GYM_NAV_LOGOS[gymSlug];

  return (
    <nav
      className="bg-black/95 backdrop-blur-sm border-b border-[#1A1A1A] sticky top-0 z-40"
      role="navigation"
      aria-label="Navegacion principal"
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo: wody icon + gym logo */}
        <Link
          href={gymPath(gymSlug, "/dashboard/athlete")}
          className="flex items-center gap-2.5 group cursor-pointer"
        >
          <Image src={wodyBlanco} alt="WODY" width={22} height={22} className="opacity-90 group-hover:opacity-100 transition-opacity duration-200" />
          <span className="w-px h-5 bg-[#2A2A2A]" aria-hidden="true" />
          {gymLogo ? (
            <Image src={gymLogo.src} alt={gymLogo.alt} width={120} height={36} className="h-9 w-auto opacity-80 group-hover:opacity-100 transition-opacity duration-200" />
          ) : (
            <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
              {gymSlug.replace(/-/g, " ")}
            </span>
          )}
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

        {/* User info + logout — desktop */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">
            {userName}{" "}
            <span className="text-brand-red">({roleLabel})</span>
          </span>
          <button
            onClick={onSignOut}
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red transition-colors duration-200 cursor-pointer min-h-[44px] flex items-center"
          >
            Salir
          </button>
        </div>

        {/* Mobile hamburger — min 44x44 touch target */}
        <button
          className="sm:hidden flex flex-col justify-center gap-1.5 p-3 min-w-[44px] min-h-[44px] cursor-pointer"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
        >
          <span
            className={[
              "block w-5 h-0.5 bg-white transition-all duration-200",
              menuOpen ? "translate-y-2 rotate-45" : "",
            ].join(" ")}
          />
          <span
            className={[
              "block w-5 h-0.5 bg-white transition-all duration-200",
              menuOpen ? "opacity-0" : "",
            ].join(" ")}
          />
          <span
            className={[
              "block w-5 h-0.5 bg-white transition-all duration-200",
              menuOpen ? "-translate-y-2 -rotate-45" : "",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="sm:hidden bg-black border-t border-[#1A1A1A] px-4 py-5 flex flex-col gap-4"
          role="menu"
        >
          <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">
            {userName}{" "}
            <span className="text-brand-red">({roleLabel})</span>
          </p>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={[
                "text-sm font-heading font-bold uppercase tracking-[0.15em] min-h-[44px] flex items-center",
                isActive(link.href)
                  ? "text-brand-red"
                  : "text-gray-300",
              ].join(" ")}
            >
              {isActive(link.href) && (
                <span className="w-1.5 h-1.5 bg-brand-red mr-3 flex-shrink-0" aria-hidden="true" />
              )}
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => {
              setMenuOpen(false);
              onSignOut();
            }}
            className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red text-left transition-colors duration-200 cursor-pointer min-h-[44px] flex items-center"
          >
            Salir
          </button>
        </div>
      )}
    </nav>
  );
}
