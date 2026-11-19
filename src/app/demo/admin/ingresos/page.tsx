import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoAccessKiosk } from "@/components/demo/access/DemoAccessKiosk";

export const metadata: Metadata = {
  title: "WODY — Demo Ingresos (Admin)",
};

export default function DemoAdminIngresosPage() {
  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <DemoAccessKiosk />
      </main>
    </>
  );
}
