import type { Metadata } from "next";
import { DemoPersonalTrainingRoute } from "@/components/demo/personal/DemoPersonalTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo Mis rutinas" };

export default function DemoPersonalStudentPage() {
  return <DemoPersonalTrainingRoute />;
}
