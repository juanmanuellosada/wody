import type { Metadata } from "next";
import { SharedDemoGymFinanceRoute } from "@/components/demo/gym/DemoGymFinanceRoute";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Cuotas (Profe)" };
export default function DemoGymTeacherPagosPage() { return <SharedDemoGymFinanceRoute routeKey="gym-teacher-pagos" routeRole="TEACHER" routeActorId="gym-fixed-teacher-linked" screen="fees" />; }
