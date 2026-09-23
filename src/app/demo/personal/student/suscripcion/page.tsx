import type { Metadata } from "next";
import { DemoPersonalBilling } from "@/components/demo/personal/DemoPersonalBilling";

export const metadata: Metadata = { title: "WODY — Demo Suscripción" };

export default function DemoPersonalSubscriptionPage() {
  return <DemoPersonalBilling />;
}
