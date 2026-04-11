import { DemoBanner } from "@/components/DemoBanner";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <DemoBanner />
      {children}
    </div>
  );
}
