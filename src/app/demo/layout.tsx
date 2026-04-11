import { DemoBanner } from "@/components/DemoBanner";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DemoBanner />
      {children}
    </>
  );
}
