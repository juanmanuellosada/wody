import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoTrainingRoute } from "@/components/demo/training/DemoTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo Mis RMs" };

export default function DemoStudentRmsPage() {
  return (
    <>
      <DemoNavbar />
      <DemoTrainingRoute routeKey="student-rms" routeRole="STUDENT" routeActorId="s1" screen="rms" />
    </>
  );
}
