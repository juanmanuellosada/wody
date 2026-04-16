"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DemoBanner() {
  const pathname = usePathname();
  // Don't show on the role selector page
  if (pathname === "/demo") return null;

  return (
    <div className="bg-brand-red text-white text-center py-1.5 px-4 relative z-50">
      <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em]">
        Modo Demo — Los cambios no se guardan —{" "}
        <Link href="/" className="underline hover:no-underline">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
