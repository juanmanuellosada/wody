import { getTodayArgentina, toInputDate } from "@/lib/dates";
import { demoFeeTeachers, getDemoFeeFixtures } from "./finance/fees-fixtures";
import type { DemoPaymentRow } from "./DemoPagosView";

/** @deprecated F5a's Cuotas adapter uses deterministic fixtures after hydration. */
export const demoTeachers = demoFeeTeachers;

/** @deprecated Kept for legacy callers; it delegates to the single fees fixture source. */
export function getDemoPagosRows(): DemoPaymentRow[] {
  return getDemoFeeFixtures(toInputDate(getTodayArgentina()));
}
