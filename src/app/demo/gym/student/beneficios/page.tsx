import type { Metadata } from "next";
import { DemoBeneficiosView } from "@/components/demo/DemoBeneficiosView";
import { demoBenefitsFixtures } from "@/components/demo/demo-benefits-fixtures";

export const metadata: Metadata = {
  title: "WODY — Demo Beneficios",
  robots: { index: false, follow: false },
};

export default function DemoGymBenefitsPage() {
  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <DemoBeneficiosView coupons={demoBenefitsFixtures} />
    </main>
  );
}
