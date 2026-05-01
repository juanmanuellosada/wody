import Image from "next/image";
import type { Metadata } from "next";
import { PersonalRegistrationForm } from "./PersonalRegistrationForm";

import wodyTexto from "@/logos/wody-texto.png";

export const metadata: Metadata = {
  title: "Registro Wody Personal",
};

export default function RegistroPersonalPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black stripe-pattern relative">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent to-brand-red/50"
        aria-hidden="true"
      />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white mb-4">
            Wody Personal
          </p>
          <div className="w-10 h-0.5 bg-brand-red mx-auto mb-3" aria-hidden="true" />
          <Image
            src={wodyTexto}
            alt="WODY"
            width={80}
            height={22}
            className="w-16 h-auto mx-auto opacity-50"
            priority
          />
          <p className="text-xs text-gray-500 mt-4">
            Pedí acceso a Wody Personal: si tu email está autorizado, te llegará un mail de confirmación.
          </p>
        </div>

        <div className="bg-panel border border-line p-6 sm:p-8">
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">
            Registro Wody Personal
          </h2>
          <PersonalRegistrationForm />
        </div>
      </div>
    </main>
  );
}
