import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoTrainingRoute } from "@/components/demo/training/DemoTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo WOD" };

export default function DemoWodFullPage() {
  return (
    <>
      <DemoNavbar />
      <DemoTrainingRoute routeKey="student-wod" routeRole="STUDENT" routeActorId="s1" screen="student-wod" />
    </>
  );
}
