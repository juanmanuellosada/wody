import type { StaticImageData } from "next/image";

import ambar from "@/logos/ambar.png";
import atr from "@/logos/atr.png";
import backerei from "@/logos/backerei.png";
import becasual from "@/logos/becalsualf-ft.png";
import bvSports from "@/logos/bv-sports.png";
import deliciasMias from "@/logos/delicias-mias.png";
import floransBelleza from "@/logos/florans-belleza.png";
import ger from "@/logos/ger.png";
import nutriteConLu from "@/logos/nutrite-con-lu.png";
import nutrilion from "@/logos/nutrilion.png";
import quinque from "@/logos/quinque.png";
import rayOfLight from "@/logos/ray-of-light.png";
import readyForWod from "@/logos/ready-for-wod.png";
import tica from "@/logos/tica.png";

export const COUPON_LOGOS: Record<string, StaticImageData> = {
  ambar,
  atr,
  backerei,
  "becalsualf-ft": becasual,
  "bv-sports": bvSports,
  "delicias-mias": deliciasMias,
  "florans-belleza": floransBelleza,
  ger,
  "nutrite-con-lu": nutriteConLu,
  nutrilion,
  quinque,
  "ray-of-light": rayOfLight,
  "ready-for-wod": readyForWod,
  tica,
};

export function getCouponLogo(logoKey: string | null): StaticImageData | null {
  if (!logoKey) return null;
  return COUPON_LOGOS[logoKey] ?? null;
}
