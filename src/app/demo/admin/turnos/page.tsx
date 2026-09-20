import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { BoxBookingDemo } from "@/components/demo/turnos/BoxBookingDemo";

export const metadata: Metadata = {
  title: "WODY — Demo Turnos (Admin)",
};

export default function DemoAdminTurnosPage() {
  return (
    <>
      <DemoNavbar />
      <BoxBookingDemo initialRole="ADMIN" />
    </>
  );
}
