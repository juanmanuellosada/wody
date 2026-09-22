import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoCatalogAdapter } from "@/components/demo/finance/DemoCatalogAdapter";

export const metadata: Metadata = {
  title: "WODY — Demo Productos (Admin)",
};

export default function DemoAdminProductosPage() {
  return (
    <>
      <DemoNavbar />
      <DemoCatalogAdapter />
    </>
  );
}
