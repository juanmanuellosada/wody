import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { BoxBookingDemo } from "@/components/demo/turnos/BoxBookingDemo";

export const metadata: Metadata = {
  title: "WODY — Demo Turnos (Alumno)",
};

export default function DemoStudentTurnosPage() {
  return (
    <>
      <DemoNavbar />
      <BoxBookingDemo initialRole="STUDENT" />
    </>
  );
}
