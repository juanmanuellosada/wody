"use client";

import { LandingExperience, type AccountOption } from "./LandingExperience";
import { ProductionContactForm } from "./ProductionContactForm";

type ProductionLandingProps = {
  accounts: AccountOption[];
  supplementaryContent: React.ReactNode;
};

export function ProductionLanding({ accounts, supplementaryContent }: ProductionLandingProps) {
  return (
    <LandingExperience
      accounts={accounts}
      supplementaryContent={supplementaryContent}
      ContactFormComponent={ProductionContactForm}
    />
  );
}
