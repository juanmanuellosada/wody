import type { Metadata } from "next";
import { DemoGymAccessKiosk } from "@/components/demo/gym/DemoGymAccessKiosk";

export const metadata: Metadata = {
  title: "WODY — Demo Gimnasio Ingresos (Admin)",
};

export default function DemoGymAdminIngresosPage() {
  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <DemoGymAccessKiosk />
    </main>
  );
}
