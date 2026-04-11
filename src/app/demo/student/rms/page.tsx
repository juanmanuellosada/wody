import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoRms } from "@/components/DemoRms";

export const metadata: Metadata = {
  title: "WODY — Demo Mis RMs",
};

export default function DemoStudentRmsPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      <DemoNavbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <DemoRms />
      </div>
    </main>
  );
}
