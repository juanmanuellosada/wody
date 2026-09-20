import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoCashAdapter } from "@/components/demo/finance/DemoCashAdapter";

export const metadata: Metadata = {
  title: "WODY — Demo Caja (Admin)",
};

export default function DemoAdminCajaPage() {
  return (
    <>
      <DemoNavbar />
      <DemoCashAdapter role="ADMIN" />
    </>
  );
}
