import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoAccessHistory } from "@/components/demo/access/DemoAccessHistory";

export const metadata: Metadata = {
  title: "WODY — Demo Historial de ingresos (Admin)",
};

export default function DemoAdminIngresosHistoryPage() {
  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <DemoAccessHistory />
      </main>
    </>
  );
}
