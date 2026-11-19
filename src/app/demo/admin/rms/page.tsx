import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoTrainingRoute } from "@/components/demo/training/DemoTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo RMs de Administración" };

export default function DemoAdminRmsPage() {
  return (
    <>
      <DemoNavbar />
      <DemoTrainingRoute routeKey="admin-rms" routeRole="ADMIN" routeActorId="a1" screen="rms" />
    </>
  );
}
