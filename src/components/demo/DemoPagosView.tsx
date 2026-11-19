import { PaymentControlView, type PaymentControlViewProps } from "@/components/payments/PaymentControlView";
import { parseFeeStatusFilter, type FeeStudent } from "./finance/fees-contract";

/** @deprecated F5a keeps this alias for callers migrating from the old Pagos entry. */
export type DemoPaymentRow = FeeStudent;

/** @deprecated Use the Cuotas adapter's local filter state. */
export const parseDemoFilter = parseFeeStatusFilter;

/** Compatibility entry only; all finance presentation is owned by PaymentControlView. */
export function DemoPagosView(props: PaymentControlViewProps) {
  return <PaymentControlView {...props} />;
}
