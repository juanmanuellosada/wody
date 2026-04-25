import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoBeneficiosView } from "@/components/demo/DemoBeneficiosView";
import { demoBeneficios } from "@/components/demo/demoBeneficiosData";

export const metadata: Metadata = {
  title: "WODY — Demo Beneficios",
};

export default function DemoStudentBeneficiosPage() {
  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <DemoBeneficiosView coupons={demoBeneficios} />
      </main>
    </>
  );
}
