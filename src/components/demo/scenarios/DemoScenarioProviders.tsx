"use client";

import { usePathname } from "next/navigation";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoAccessProvider } from "@/components/demo/access/DemoAccessProvider";
import { DemoFinanceProvider } from "@/components/demo/finance/DemoFinanceProvider";
import { DemoPersonalProvider } from "@/components/demo/personal/DemoPersonalProvider";
import { DemoTrainingProvider } from "@/components/demo/training/DemoTrainingProvider";
import { DemoGymProvider } from "@/components/demo/gym/DemoGymProvider";
import { DemoGymProfileProvider } from "@/components/demo/gym/DemoGymProfileProvider";
import { DemoGymFinanceProvider } from "@/components/demo/gym/DemoGymFinanceProvider";

export type DemoScenario = "BOX" | "PERSONAL" | "GYM";

type DemoScenarioProvidersProps = {
  children: React.ReactNode;
  /** Root demo pages keep their legacy per-page BOX navbar, but PERSONAL has no sub-layout. */
  rootPersonalNavigation?: boolean;
};

export function scenarioForPathname(pathname: string): DemoScenario | null {
  if (pathname === "/demo/gym" || pathname.startsWith("/demo/gym/")) return "GYM";
  if (pathname === "/demo/personal" || pathname.startsWith("/demo/personal/")) return "PERSONAL";
  if (pathname === "/demo" || pathname === "/demo/" || pathname === "/demo/admin" || pathname === "/demo/teacher" || pathname === "/demo/student" || pathname.startsWith("/demo/admin/") || pathname.startsWith("/demo/teacher/") || pathname.startsWith("/demo/student/")) return "BOX";
  return null;
}

/**
 * A pathname-gated provider boundary. A null pathname renders no scenario, so
 * compatibility hydration cannot briefly mount BOX ledgers on a PERSONAL route.
 */
export function DemoScenarioProviders({ children, rootPersonalNavigation = false }: DemoScenarioProvidersProps) {
  const pathname = usePathname();

  // Compatibility mode may briefly yield null; do not choose BOX until routing is known.
  if (pathname === null) return null;
  const scenario = scenarioForPathname(pathname);
  if (scenario === null) return null;

  if (scenario === "GYM") {
    return (
      <DemoGymProvider>
        <DemoGymProfileProvider>
          <DemoGymFinanceProvider><DemoNavbar scenario="GYM" />{children}</DemoGymFinanceProvider>
        </DemoGymProfileProvider>
      </DemoGymProvider>
    );
  }

  if (scenario === "PERSONAL") {
    return (
      <DemoPersonalProvider>
        {rootPersonalNavigation && <DemoNavbar scenario="PERSONAL" />}
        {children}
      </DemoPersonalProvider>
    );
  }

  return (
    <DemoTrainingProvider>
      <DemoFinanceProvider>
        <DemoAccessProvider>{children}</DemoAccessProvider>
      </DemoFinanceProvider>
    </DemoTrainingProvider>
  );
}
