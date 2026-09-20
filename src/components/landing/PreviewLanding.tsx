"use client";

import { ContactForm } from "./ContactForm";
import { LandingExperience, type AccountOption } from "./LandingExperience";
import { PreviewBenefits } from "./PreviewBenefits";

const WODY_ORIGIN = "https://www.wody.com.ar";

const accounts: AccountOption[] = [
  { slug: "unidos-garage", name: "Unidos Garage CrossFit", kind: "BOX", location: "Los Polvorines, Buenos Aires", primaryColor: "#e31414", logo: `${WODY_ORIGIN}/logos/unidos-logo-completo.png` },
  { slug: "rompiendo-limites", name: "Rompiendo Limites CrossFit", kind: "BOX", location: "Boulogne, Buenos Aires", primaryColor: "#e31414", logo: `${WODY_ORIGIN}/logos/rompiendo-limites.png` },
  { slug: "atlas-gym", name: "Atlas", kind: "GYM", location: "Los Polvorines, Buenos Aires", primaryColor: "#e31414", logo: `${WODY_ORIGIN}/logos/atlas-gym.png` },
  { slug: "mila-fit", name: "Mila Fit", kind: "GYM", location: "Los Polvorines, Buenos Aires", primaryColor: "#e31414", logo: `${WODY_ORIGIN}/logos/mila-fit.png` },
  { slug: "unidos-gap", name: "Unidos - GAP", kind: "GYM", primaryColor: "#e31414", logo: "https://yc8n1ahwk4h5hvb2.public.blob.vercel-storage.com/gyms/un%20ds%20gap%20%281%29-3MBFn4jVYk2oJ1yt5m7KBmyoLF6sNJ.webp" },
  { slug: "fitclub", name: "FIT CLUB", kind: "GYM", primaryColor: "#e31414", logo: "https://yc8n1ahwk4h5hvb2.public.blob.vercel-storage.com/gyms/UB-OA8skaxFprDQOl3js8Wbujt73nKzcD.webp" },
];

function PreviewContactForm({ onClose, formType }: { onClose: () => void; formType: "GYM" | "PERSONAL" }) {
  return <ContactForm onClose={onClose} formType={formType} mode="preview" />;
}

export function PreviewLanding() {
  return <LandingExperience mode="preview" accounts={accounts} supplementaryContent={<PreviewBenefits />} ContactFormComponent={PreviewContactForm} />;
}
