import { DemoBanner } from "@/components/DemoBanner";
import { DemoFinanceProvider } from "@/components/demo/finance/DemoFinanceProvider";
import { DemoTrainingProvider } from "@/components/demo/training/DemoTrainingProvider";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoTrainingProvider>
      <DemoFinanceProvider>
        <div className="min-h-screen flex flex-col bg-black">
          <DemoBanner />
          {children}
        </div>
      </DemoFinanceProvider>
    </DemoTrainingProvider>
  );
}
