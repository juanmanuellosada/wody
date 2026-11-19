import type { Metadata } from "next";
import { DemoGymAccessHistory } from "@/components/demo/gym/DemoGymAccessHistory";

export const metadata: Metadata = {
  title: "WODY — Demo Gimnasio Historial de ingresos (Admin)",
};

export default function DemoGymAdminIngresosHistoryPage() {
  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <DemoGymAccessHistory />
    </main>
  );
}
