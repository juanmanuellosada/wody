import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoTrainingRoute } from "@/components/demo/training/DemoTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo Profe" };

export default function DemoTeacherPage() {
  return (
    <>
      <DemoNavbar />
      <DemoTrainingRoute routeKey="teacher-home" routeRole="TEACHER" routeActorId="t1" screen="staff" />
    </>
  );
}
