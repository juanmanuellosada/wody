import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoTrainingRoute } from "@/components/demo/training/DemoTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo Mis RMs" };

export default function DemoTeacherRmsPage() {
  return (
    <>
      <DemoNavbar />
      <DemoTrainingRoute routeKey="teacher-rms" routeRole="TEACHER" routeActorId="t1" screen="rms" />
    </>
  );
}
