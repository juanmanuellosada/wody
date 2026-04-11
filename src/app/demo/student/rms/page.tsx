import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoRms } from "@/components/DemoRms";

export const metadata: Metadata = {
  title: "WODY — Demo Mis RMs",
};

export default function DemoStudentRmsPage() {
  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <DemoRms />
      </main>
    </>
  );
}
