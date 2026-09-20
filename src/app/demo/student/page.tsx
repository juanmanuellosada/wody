import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoTrainingRoute } from "@/components/demo/training/DemoTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo Alumno" };

export default function DemoStudentPage() {
  return (
    <>
      <DemoNavbar />
      <DemoTrainingRoute routeKey="student-home" routeRole="STUDENT" routeActorId="s1" screen="student" />
    </>
  );
}
