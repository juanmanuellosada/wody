import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoFeesAdapter } from "@/components/demo/finance/DemoFeesAdapter";

export const metadata: Metadata = {
  title: "WODY — Demo Cuotas (Profe)",
};

export default function DemoTeacherPagosPage() {
  return (
    <>
      <DemoNavbar />
      <DemoFeesAdapter role="TEACHER" />
    </>
  );
}
