import type { Metadata } from "next";
import { SharedDemoGymFinanceRoute } from "@/components/demo/gym/DemoGymFinanceRoute";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Cuotas (Admin)" };
export default function DemoGymAdminPagosPage() { return <SharedDemoGymFinanceRoute routeKey="gym-admin-pagos" routeRole="ADMIN" routeActorId="gym-fixed-admin" screen="fees" />; }
