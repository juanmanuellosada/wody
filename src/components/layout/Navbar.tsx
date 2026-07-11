"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { GymKind, Role } from "@prisma/client";
import { gymPath, hasAccessControl, isPersonalGym } from "@/lib/gym";
import type { GymTerms } from "@/lib/gym-terms";

import wodyBlanco from "@/logos/wody-blanco.png";
import { GYM_LOGOS_HORIZONTAL, GYM_LOGOS_SQUARE } from "@/lib/gym-logos";

interface GymSwitcherItem {
  slug: string;
  name: string;
  logo: string | null;
}

interface NavbarProps {
  userName: string;
  role: Role;
  gymSlug: string;
  gymName: string;
  gymKind: GymKind;
  onSignOut: () => void;
  terms: GymTerms;
  canCreateOwnRoutines?: boolean;
  pendingJoinRequestsCount?: number;
  gymSwitcherList?: GymSwitcherItem[];
  emailVerified?: boolean;
  canViewRevenue?: boolean;
}

interface NavLink {
  href: string;
  label: string;
  badge?: number;
}

function getNavLinks(
  role: Role,
  gymSlug: string,
  gymKind: GymKind,
  terms: GymTerms,
  canCreateOwnRoutines: boolean,
  pendingJoinRequestsCount: number,
  canViewRevenue: boolean
): NavLink[] {
  if (isPersonalGym(gymKind)) {
    return [
      { href: gymPath(gymSlug, "/dashboard/mis-rutinas"), label: `Mis ${terms.wods}` },
      { href: gymPath(gymSlug, "/dashboard/rms"), label: `Mis ${terms.rms}` },
      { href: gymPath(gymSlug, "/dashboard/timers"), label: "Cronómetros" },
      { href: gymPath(gymSlug, "/beneficios"), label: "Beneficios" },
      { href: gymPath(gymSlug, "/perfil/suscripcion"), label: "Suscripción" },
    ];
  }

  const accessControl = hasAccessControl(gymSlug);
  const myRoutinesLink = {
    href: gymPath(gymSlug, "/dashboard/mis-rutinas"),
    label: `Mis ${terms.wods}`,
  };

  if (role === "ADMIN") {
    return [
      { href: gymPath(gymSlug, "/admin"), label: "Panel Admin" },
      {
        href: gymPath(gymSlug, "/admin/invitaciones"),
        label: "Invitaciones",
        ...(pendingJoinRequestsCount > 0 ? { badge: pendingJoinRequestsCount } : {}),
      },
      { href: gymPath(gymSlug, "/dashboard/teacher"), label: "Dashboard Profe" },
      ...(canCreateOwnRoutines ? [myRoutinesLink] : []),
      { href: gymPath(gymSlug, "/cuotas"), label: "Cuotas" },
      { href: gymPath(gymSlug, "/caja"), label: "Caja" },
      ...(canViewRevenue ? [{ href: gymPath(gymSlug, "/productos"), label: "Productos" }] : []),
      ...(accessControl
        ? [{ href: gymPath(gymSlug, "/ingresos"), label: "Ingresos" }]
        : []),
      { href: gymPath(gymSlug, "/dashboard/rms"), label: `Mis ${terms.rms}` },
      { href: gymPath(gymSlug, "/dashboard/timers"), label: "Cronómetros" },
      { href: gymPath(gymSlug, "/beneficios"), label: "Beneficios" },
      { href: gymPath(gymSlug, "/admin/billing"), label: "Suscripción" },
    ];
  }
  if (role === "TEACHER") {
    return [
      { href: gymPath(gymSlug, "/dashboard/teacher"), label: `${terms.wods} de mis alumnos` },
      ...(canCreateOwnRoutines ? [myRoutinesLink] : []),
      { href: gymPath(gymSlug, "/cuotas"), label: "Cuotas" },
      { href: gymPath(gymSlug, "/caja"), label: "Caja" },
      { href: gymPath(gymSlug, "/dashboard/rms"), label: `Mis ${terms.rms}` },
      { href: gymPath(gymSlug, "/dashboard/timers"), label: "Cronómetros" },
      { href: gymPath(gymSlug, "/beneficios"), label: "Beneficios" },
    ];
  }
  if (role === "ACCESS") {
    if (!accessControl) return [];
    return [
      { href: gymPath(gymSlug, "/ingresos"), label: "Ingresos" },
      { href: gymPath(gymSlug, "/ingresos/historial"), label: "Historial" },
    ];
  }
  return [
    { href: gymPath(gymSlug, "/dashboard/athlete"), label: `Mi ${terms.wod}` },
    ...(canCreateOwnRoutines
      ? [{ href: gymPath(gymSlug, "/dashboard/mis-rutinas"), label: "Mis rutinas" }]
      : []),
    { href: gymPath(gymSlug, "/dashboard/rms"), label: `Mis ${terms.rms}` },
    { href: gymPath(gymSlug, "/dashboard/timers"), label: "Cronómetros" },
    { href: gymPath(gymSlug, "/beneficios"), label: "Beneficios" },
  ];
}

export function Navbar({ userName, role, gymSlug, gymName, gymKind, onSignOut, terms, canCreateOwnRoutines = false, pendingJoinRequestsCount = 0, gymSwitcherList = [], canViewRevenue = false }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const pathname = usePathname();
  const links = getNavLinks(role, gymSlug, gymKind, terms, canCreateOwnRoutines, pendingJoinRequestsCount, canViewRevenue);

  async function handleGymSwitch(targetSlug: string) {
    if (targetSlug === gymSlug || switching) return;

    setSwitching(true);
    try {
      const formData = new FormData();
      formData.set("targetSlug", targetSlug);
      const res = await fetch("/api/auth/switch-gym", {
        method: "POST",
        body: formData,
        redirect: "follow",
      });
      // For verified users: server switches the session and redirects to the
      // target gym dashboard. For unverified users: server signs out first
      // (clears the session cookie so the proxy guard doesn't bounce) then
      // redirects to the target gym's login page with ?email= prefilled.
      // In both cases, follow the final URL.
      if (res.ok || res.redirected) {
        window.location.href = res.url || gymPath(targetSlug, "/dashboard/athlete");
      } else {
        window.location.href = gymPath(targetSlug, "/login");
      }
    } catch {
      window.location.href = gymPath(targetSlug, "/login");
    } finally {
      setSwitching(false);
    }
  }

  const roleLabel =
    role === "ADMIN"
      ? "Admin"
      : role === "TEACHER"
      ? "Profe"
      : role === "ACCESS"
      ? "Accesos"
      : "Atleta";

  function isActive(href: string) {
    return pathname === href;
  }

  const horizontalLogo = GYM_LOGOS_HORIZONTAL[gymSlug];
  const squareLogo = GYM_LOGOS_SQUARE[gymSlug];

  return (
    <nav
      className="bg-black/95 backdrop-blur-sm border-b border-line sticky top-0 z-40"
      role="navigation"
      aria-label="Navegacion principal"
    >
      <div className="px-4 h-16 flex items-center justify-between">
        {/* Logo: wody icon + gym logo */}
        <Link
          href={gymPath(gymSlug, "/dashboard/athlete")}
          className="flex items-center gap-2.5 group cursor-pointer"
        >
          <Image src={wodyBlanco} alt="WODY" width={22} height={22} className="opacity-90 group-hover:opacity-100 transition-opacity duration-200" unoptimized />
          <span className="w-px h-5 bg-edge" aria-hidden="true" />
          {horizontalLogo ? (
            <Image src={horizontalLogo.src} alt={horizontalLogo.alt} width={120} height={36} className="h-9 w-auto opacity-80 group-hover:opacity-100 transition-opacity duration-200" unoptimized />
          ) : squareLogo ? (
            <Image src={squareLogo} alt={gymName} width={36} height={36} className="h-9 w-9 object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-200" unoptimized />
          ) : (
            <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400 opacity-80 group-hover:opacity-100 transition-opacity duration-200">
              {gymName}
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
                "text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors duration-200 relative py-1 flex items-center",
                isActive(link.href)
                  ? "text-brand-red"
                  : "text-gray-400 hover:text-white",
              ].join(" ")}
            >
              {link.label}
              {link.badge !== undefined && (
                <span
                  className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-red text-white text-[10px] font-bold ml-1.5 leading-none"
                  aria-label={`${link.badge > 99 ? "99+" : link.badge} solicitudes pendientes`}
                >
                  {link.badge > 99 ? "99+" : link.badge}
                </span>
              )}
              {isActive(link.href) && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-red"
                  aria-hidden="true"
                />
              )}
            </Link>
          ))}
        </div>

        {/* Gym switcher — desktop (only for STUDENT with 2+ gyms) */}
        {gymSwitcherList.length >= 2 && (
          <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-line" aria-label="Cambiar gym">
            {gymSwitcherList.map((gym) => {
              const isCurrent = gym.slug === gymSlug;
              return (
                <button
                  key={gym.slug}
                  onClick={() => handleGymSwitch(gym.slug)}
                  disabled={isCurrent || switching}
                  title={isCurrent ? gym.name : `Cambiar a ${gym.name}`}
                  aria-current={isCurrent ? "true" : undefined}
                  className={[
                    "w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-heading font-bold uppercase transition-opacity duration-200 flex-shrink-0",
                    isCurrent
                      ? "ring-2 ring-brand-red opacity-100 cursor-default"
                      : "opacity-60 hover:opacity-100 cursor-pointer",
                    switching && !isCurrent ? "pointer-events-none" : "",
                  ].join(" ")}
                >
                  {gym.logo ? (
                    <Image
                      src={gym.logo}
                      alt={gym.name}
                      width={32}
                      height={32}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="bg-white/10 w-full h-full flex items-center justify-center text-white">
                      {gym.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* User info + logout — desktop */}
        <div className="hidden sm:flex items-center gap-4 pl-6 border-l border-line">
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
          className="sm:hidden bg-black border-t border-line px-4 py-5 flex flex-col gap-4"
          role="menu"
        >
          <p className="text-xs text-gray-500 font-heading uppercase tracking-[0.1em]">
            {userName}{" "}
            <span className="text-brand-red">({roleLabel})</span>
          </p>
          {/* Gym switcher — mobile */}
          {gymSwitcherList.length >= 2 && (
            <div className="flex items-center gap-3" aria-label="Cambiar gym">
              {gymSwitcherList.map((gym) => {
                const isCurrent = gym.slug === gymSlug;
                return (
                  <button
                    key={gym.slug}
                    onClick={() => {
                      setMenuOpen(false);
                      handleGymSwitch(gym.slug);
                    }}
                    disabled={isCurrent || switching}
                    title={isCurrent ? gym.name : `Cambiar a ${gym.name}`}
                    aria-current={isCurrent ? "true" : undefined}
                    className={[
                      "w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-heading font-bold uppercase transition-opacity duration-200 flex-shrink-0",
                      isCurrent
                        ? "ring-2 ring-brand-red opacity-100 cursor-default"
                        : "opacity-60 hover:opacity-100 cursor-pointer",
                      switching && !isCurrent ? "pointer-events-none" : "",
                    ].join(" ")}
                  >
                    {gym.logo ? (
                      <Image
                        src={gym.logo}
                        alt={gym.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="bg-white/10 w-full h-full flex items-center justify-center text-white">
                        {gym.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
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
              {link.badge !== undefined && (
                <span
                  className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-red text-white text-[10px] font-bold ml-2 leading-none"
                  aria-label={`${link.badge > 99 ? "99+" : link.badge} solicitudes pendientes`}
                >
                  {link.badge > 99 ? "99+" : link.badge}
                </span>
              )}
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
