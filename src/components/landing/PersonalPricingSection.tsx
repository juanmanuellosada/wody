"use client";

import { useState } from "react";
import { ContactForm } from "@/components/landing/ContactForm";

const FEATURES = [
  "Armá y organizá tus propias rutinas",
  "Registrá tus récords personales con historial",
  "Cronómetros y timers para tus entrenamientos",
  "Beneficios y cupones de nuestros partners",
  "Compartí tus logros en Instagram",
];

export function PersonalPricingSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red text-center mb-3">
            Para entrenar a tu manera
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-3">
            Tu entrenamiento, en un solo lugar
          </h2>
          <p className="text-sm text-gray-500 font-body text-center mb-12 max-w-md mx-auto">
            Armá tus rutinas, registrá tus PRs y mirá tu progreso desde tu celular. Probalo 7 días sin pagar.
          </p>

          <div className="max-w-sm mx-auto border border-purple-500/20 bg-purple-500/[0.03] p-8 flex flex-col gap-6">
            <div>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-purple-400 mb-1">
                Plan Personal — Todo incluido
              </p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-heading font-black text-white">
                  $7.000
                </span>
                <span className="text-sm text-gray-500 font-body mb-1">ARS / mes</span>
              </div>
              <p className="text-xs text-emerald-400 font-heading font-bold uppercase tracking-[0.1em] mt-1">
                7 días gratis · sin tarjeta · sin compromiso · cancelás cuando quieras
              </p>
            </div>

            <ul className="flex flex-col gap-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-xs text-gray-400 font-body">
                  <span className="text-purple-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                    &#8226;
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setOpen(true)}
              className="w-full px-6 py-4 bg-purple-600 text-white font-heading font-bold uppercase tracking-[0.15em] text-sm hover:bg-purple-700 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
            >
              Contactanos
            </button>
          </div>
        </div>
      </section>

      {open && <ContactForm onClose={() => setOpen(false)} formType="PERSONAL" />}
    </>
  );
}
