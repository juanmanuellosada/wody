import type { Metadata } from "next";
import { GymBookingDemo } from "@/components/demo/turnos/GymBookingDemo";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Turnos (Profe)" };
export default function PreviewDemoGymTeacherTurnosPage() { return <GymBookingDemo initialRole="TEACHER" />; }
