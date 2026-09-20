import { DemoBanner } from "@/components/DemoBanner";
import { DemoTrainingProvider } from "@/components/demo/training/DemoTrainingProvider";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoTrainingProvider>
      <div className="min-h-screen flex flex-col bg-black">
        <DemoBanner />
        {children}
      </div>
    </DemoTrainingProvider>
  );
}
