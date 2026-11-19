import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { DemoTrainingRoute } from "@/components/demo/training/DemoTrainingRoute";

export const metadata: Metadata = { title: "WODY — Demo Administración" };

export default function DemoAdminPage() {
  return (
    <>
      <DemoNavbar />
      <DemoTrainingRoute routeKey="admin-home" routeRole="ADMIN" routeActorId="a1" screen="staff" />
    </>
  );
}
