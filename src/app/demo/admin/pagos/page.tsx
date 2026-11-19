import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoFeesAdapter } from "@/components/demo/finance/DemoFeesAdapter";

export const metadata: Metadata = {
  title: "WODY — Demo Cuotas (Admin)",
};

export default function DemoAdminPagosPage() {
  return (
    <>
      <DemoNavbar />
      <DemoFeesAdapter role="ADMIN" />
    </>
  );
}
