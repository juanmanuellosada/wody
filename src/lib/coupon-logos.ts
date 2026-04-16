import type { StaticImageData } from "next/image";

import atr from "@/logos/atr.png";
import becasual from "@/logos/becalsualf-ft.png";
import bvSports from "@/logos/bv-sports.png";
import nutriteConLu from "@/logos/nutrite-con-lu.png";
import readyForWod from "@/logos/ready-for-wod.png";

export const COUPON_LOGOS: Record<string, StaticImageData> = {
  atr,
  "becalsualf-ft": becasual,
  "bv-sports": bvSports,
  "nutrite-con-lu": nutriteConLu,
  "ready-for-wod": readyForWod,
};

export function getCouponLogo(logoKey: string | null): StaticImageData | null {
  if (!logoKey) return null;
  return COUPON_LOGOS[logoKey] ?? null;
}
