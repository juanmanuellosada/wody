"use client";

import { ContactForm } from "./ContactForm";
import { LandingExperience } from "./LandingExperience";

function PreviewContactForm({ onClose, formType }: { onClose: () => void; formType: "GYM" | "PERSONAL" }) {
  return <ContactForm onClose={onClose} formType={formType} mode="preview" />;
}

export function PreviewLanding() {
  return <LandingExperience mode="preview" ContactFormComponent={PreviewContactForm} />;
}
