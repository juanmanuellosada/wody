import type { Metadata } from "next";
import { GymBookingDemo } from "@/components/demo/turnos/GymBookingDemo";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Turnos (Admin)" };
export default function PreviewDemoGymAdminTurnosPage() { return <GymBookingDemo initialRole="ADMIN" />; }
