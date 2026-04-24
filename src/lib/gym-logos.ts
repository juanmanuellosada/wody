import type { StaticImageData } from "next/image";

import unidosLogoCompleto from "@/logos/unidos-logo-completo.png";
import unidosTexto from "@/logos/unidos-texto.png";
import rompiendoLimites from "@/logos/rompiendo-limites.png";
import rompiendoHorizontal from "@/logos/rompiendo-limites-horizontal.png";
import atlasGym from "@/logos/atlas-gym.png";
import milaFit from "@/logos/mila-fit.png";

export const GYM_LOGOS_SQUARE: Record<string, StaticImageData> = {
  "unidos-garage": unidosLogoCompleto,
  "rompiendo-limites": rompiendoLimites,
  "atlas-gym": atlasGym,
  "mila-fit": milaFit,
};

export const GYM_LOGOS_HORIZONTAL: Record<string, { src: StaticImageData; alt: string }> = {
  "unidos-garage": { src: unidosTexto, alt: "Unidos Garage" },
  "rompiendo-limites": { src: rompiendoHorizontal, alt: "Rompiendo Limites" },
};
