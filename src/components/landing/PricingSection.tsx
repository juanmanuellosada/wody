"use client";

import { useState } from "react";
import { ContactForm } from "@/components/landing/ContactForm";

const FEATURES = [
  "Control de cuotas y pagos con vencimientos automáticos",
  "Rutinas diarias que el alumno ve desde su celular",
  "Récords personales con historial por alumno",
  "Control de accesos con QR en la puerta",
  "Notificaciones push: rutinas, recordatorios y vencimientos",
  "Roles separados: admin, profe, alumno y accesos",
  "Logros listos para compartir en Instagram",
];

export function PricingSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red text-center mb-3">
            Para gimnasios y boxes
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-3">
            Todo lo que tu gym necesita, en un solo lugar
          </h2>
          <p className="text-sm text-gray-500 font-body text-center mb-12 max-w-md mx-auto">
            Cobros, rutinas, accesos, comunicación: lo que tu gym hace todos los días, organizado y sin planillas. Probalo 7 días sin pagar.
          </p>

          <div className="max-w-sm mx-auto border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col gap-6">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
                Plan estándar — Todo incluido
              </p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-heading font-black text-white">
                  $40.000
                </span>
                <span className="text-sm text-gray-500 font-body mb-1">ARS / mes</span>
              </div>
              <p className="text-xs text-emerald-400 font-heading font-bold uppercase tracking-[0.1em] mt-1">
                7 días gratis · sin tarjeta · sin compromiso
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
