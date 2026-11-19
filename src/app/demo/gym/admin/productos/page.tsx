import type { Metadata } from "next";
import { SharedDemoGymFinanceRoute } from "@/components/demo/gym/DemoGymFinanceRoute";

export const metadata: Metadata = { title: "WODY — Demo Gimnasio Productos (Admin)" };
export default function DemoGymAdminProductosPage() { return <SharedDemoGymFinanceRoute routeKey="gym-admin-productos" routeRole="ADMIN" routeActorId="gym-fixed-admin" screen="products" />; }
