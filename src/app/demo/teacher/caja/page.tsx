import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoCashAdapter } from "@/components/demo/finance/DemoCashAdapter";

export const metadata: Metadata = {
  title: "WODY — Demo Caja (Profe)",
};

export default function DemoTeacherCajaPage() {
  return (
    <>
      <DemoNavbar />
      <DemoCashAdapter role="TEACHER" />
    </>
  );
}
