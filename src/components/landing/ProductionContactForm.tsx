"use client";

import { ContactForm, type SignupRequestPayload } from "./ContactForm";

type ProductionContactFormProps = {
  onClose: () => void;
  formType?: "GYM" | "PERSONAL";
};

async function submitSignupRequest(payload: SignupRequestPayload) {
  const response = await fetch("/api/signup-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.ok) return { ok: true };
  if (response.status === 429) {
    return {
      ok: false,
      error: "Recibimos muchas solicitudes desde esta conexión. Esperá un rato e intentá de nuevo.",
    };
  }

  const responseBody = await response.json().catch(() => null);
  return {
    ok: false,
    error: responseBody?.error || "No pudimos enviar la solicitud. Probá de nuevo más tarde.",
  };
}

export function ProductionContactForm({ onClose, formType }: ProductionContactFormProps) {
  return (
    <ContactForm
      onClose={onClose}
      formType={formType}
      mode="production"
      submitRequest={submitSignupRequest}
    />
  );
}
