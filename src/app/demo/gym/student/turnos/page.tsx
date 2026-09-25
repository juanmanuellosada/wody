import type { Metadata } from "next";
import { GymBookingDemo } from "@/components/demo/turnos/GymBookingDemo";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Turnos (Alumno)" };
export default function DemoGymStudentTurnosPage() { return <GymBookingDemo initialRole="STUDENT" />; }
