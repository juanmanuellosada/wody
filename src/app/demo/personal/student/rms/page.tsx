import type { Metadata } from "next";
import { DemoPersonalRms } from "@/components/demo/personal/DemoPersonalRms";

export const metadata: Metadata = { title: "WODY — Demo Mis PRs" };

export default function DemoPersonalRmsPage() {
  return <DemoPersonalRms />;
}
