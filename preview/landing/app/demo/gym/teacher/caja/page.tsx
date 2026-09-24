import type { Metadata } from "next";
import { SharedDemoGymFinanceRoute } from "@/components/demo/gym/DemoGymFinanceRoute";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Caja (Profe)" };
export default function PreviewDemoGymTeacherCajaPage() { return <SharedDemoGymFinanceRoute routeKey="gym-teacher-caja" routeRole="TEACHER" routeActorId="gym-fixed-teacher-linked" screen="cash" />; }
