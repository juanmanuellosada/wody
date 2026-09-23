import { DemoBanner } from "@/components/DemoBanner";
import { DemoScenarioProviders } from "@/components/demo/scenarios/DemoScenarioProviders";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <DemoBanner />
      <DemoScenarioProviders rootPersonalNavigation>{children}</DemoScenarioProviders>
    </div>
  );
}
