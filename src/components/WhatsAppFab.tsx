"use client";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

const WHATSAPP_NUMBER = "5491169764169";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe57] text-white pl-4 pr-5 py-3 rounded-full shadow-lg shadow-[#25D366]/20 transition-all duration-200 hover:scale-105"
      aria-label="Contactar por WhatsApp"
    >
      <WhatsAppIcon size={22} />
      <span className="text-sm font-heading font-bold uppercase tracking-[0.05em] hidden sm:inline">
        Contactar por WhatsApp
      </span>
    </a>
  );
}
