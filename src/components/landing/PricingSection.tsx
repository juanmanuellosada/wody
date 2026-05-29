"use client";

import { useState } from "react";
import { ContactForm } from "@/components/landing/ContactForm";

const FEATURES = [
  "Rutinas diarias para cada alumno",
  "Récords máximos con historial",
  "Control de accesos e ingresos",
  "Notificaciones push",
  "Multi-rol: admin, profe, alumno",
  "Compartir logros en Instagram",
];

export function PricingSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red text-center mb-3">
            Sumá tu centro
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-3">
            ¿Querés WODY para tu gym?
          </h2>
          <p className="text-sm text-gray-500 font-body text-center mb-12 max-w-md mx-auto">
            Probalo 30 días gratis, sin tarjeta. Después es un precio fijo mensual.
          </p>

          <div className="max-w-sm mx-auto border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col gap-6">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
                Plan estándar
              </p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-heading font-black text-white">
                  $60.000
                </span>
                <span className="text-sm text-gray-500 font-body mb-1">ARS / mes</span>
              </div>
              <p className="text-xs text-emerald-400 font-heading font-bold uppercase tracking-[0.1em] mt-1">
                30 días de trial sin tarjeta
              </p>
            </div>

            <ul className="flex flex-col gap-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-gray-400 font-body">
                  <span className="text-brand-red flex-shrink-0 mt-0.5" aria-hidden="true">
                    &#8226;
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setOpen(true)}
              className="w-full px-6 py-4 bg-brand-red text-white font-heading font-bold uppercase tracking-[0.15em] text-sm hover:bg-brand-red-dark transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              Contactanos
            </button>
          </div>
        </div>
      </section>

      {open && <ContactForm onClose={() => setOpen(false)} />}
    </>
  );
}
