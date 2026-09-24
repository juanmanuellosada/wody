import type { Metadata } from "next";
import { SharedDemoGymFinanceRoute } from "@/components/demo/gym/DemoGymFinanceRoute";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Caja (Admin)" };
export default function DemoGymAdminCajaPage() { return <SharedDemoGymFinanceRoute routeKey="gym-admin-caja" routeRole="ADMIN" routeActorId="gym-fixed-admin" screen="cash" />; }
