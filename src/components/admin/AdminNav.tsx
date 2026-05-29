"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import wodyBlanco from "@/logos/wody-blanco.png";

interface AdminNavProps {
  userName: string;
  onSignOut: () => void;
}

const NAV_LINKS = [
  { href: "/admin", label: "Suscripciones" },
  { href: "/admin/gyms", label: "Gyms" },
  { href: "/admin/signup-requests", label: "Leads" },
  { href: "/admin/coupons", label: "Cupones" },
  { href: "/admin/wody-personal", label: "Wody Personal" },
  { href: "/admin/personal-whitelist", label: "Whitelist Personal" },
];

export function AdminNav({ userName, onSignOut }: AdminNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="bg-black/95 backdrop-blur-sm border-b border-line sticky top-0 z-40"
      role="navigation"
      aria-label="Navegación panel super admin"
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo + label */}
        <Link href="/admin" className="flex items-center gap-2.5 group cursor-pointer">
          <Image
            src={wodyBlanco}
            alt="WODY"
            width={22}
            height={22}
            className="opacity-90 group-hover:opacity-100 transition-opacity duration-200"
          />
          <span className="w-px h-5 bg-edge" aria-hidden="true" />
          <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">
            Super Admin
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 relative py-1",
                isActive(link.href) ? "text-brand-red" : "text-gray-400 hover:text-white",
              ].join(" ")}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red" aria-hidden="true" />
              )}
            </Link>
          ))}
        </div>

        {/* User + logout — desktop */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">
            {userName}
          </span>
          <button
            onClick={onSignOut}
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red transition-colors duration-200 cursor-pointer min-h-[44px] flex items-center"
          >
            Salir
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col justify-center gap-1.5 p-3 min-w-[44px] min-h-[44px] cursor-pointer"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
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
          <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">{userName}</p>
          {NAV_LINKS.map((link) => (
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
          <button
            onClick={() => { setMenuOpen(false); onSignOut(); }}
            className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red text-left transition-colors duration-200 cursor-pointer min-h-[44px] flex items-center"
          >
            Salir
          </button>
        </div>
      )}
    </nav>
  );
}
