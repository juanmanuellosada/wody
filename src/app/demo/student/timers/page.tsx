import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { TimersClient } from "@/components/timers/TimersClient";

export const metadata: Metadata = {
  title: "WODY — Demo Cronómetros",
};

export default function DemoTimersPage() {
  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <TimersClient />
      </main>
    </>
  );
}
