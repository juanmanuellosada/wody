"use client";

import { usePathname } from "next/navigation";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoAccessProvider } from "@/components/demo/access/DemoAccessProvider";
import { DemoFinanceProvider } from "@/components/demo/finance/DemoFinanceProvider";
import { DemoPersonalProvider } from "@/components/demo/personal/DemoPersonalProvider";
import { DemoTrainingProvider } from "@/components/demo/training/DemoTrainingProvider";

export type DemoScenario = "BOX" | "PERSONAL";

type DemoScenarioProvidersProps = {
  children: React.ReactNode;
  /** Root demo pages keep their legacy per-page BOX navbar, but PERSONAL has no sub-layout. */
  rootPersonalNavigation?: boolean;
};

function scenarioForPathname(pathname: string): DemoScenario {
  return pathname === "/demo/personal" || pathname.startsWith("/demo/personal/")
    ? "PERSONAL"
    : "BOX";
}

/**
 * A pathname-gated provider boundary. A null pathname renders no scenario, so
 * compatibility hydration cannot briefly mount BOX ledgers on a PERSONAL route.
 */
export function DemoScenarioProviders({ children, rootPersonalNavigation = false }: DemoScenarioProvidersProps) {
  const pathname = usePathname();

  // Compatibility mode may briefly yield null; do not choose BOX until routing is known.
  if (pathname === null) return null;

  if (scenarioForPathname(pathname) === "PERSONAL") {
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
