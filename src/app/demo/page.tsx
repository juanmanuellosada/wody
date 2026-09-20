import type { Metadata } from "next";
import { DemoTrainingOverview } from "@/components/demo/training/DemoTrainingOverview";

export const metadata: Metadata = {
  title: "WODY — Demo",
  description: "Explorá WODY con datos ficticios de un BOX de demostración.",
};

export default function DemoSelectorPage() {
  return <DemoTrainingOverview />;
}
