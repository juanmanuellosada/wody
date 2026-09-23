import { DemoBanner } from "../../../../src/components/DemoBanner";
import { DemoNavbar } from "../../../../src/components/DemoNavbar";
import { DemoScenarioProviders } from "../../../../src/components/demo/scenarios/DemoScenarioProviders";

const supportedRoutes = [
  "/demo/admin",
  "/demo/admin/rms",
  "/demo/admin/turnos",
  "/demo/admin/pagos",
  "/demo/admin/caja",
  "/demo/admin/productos",
  "/demo/admin/ingresos",
  "/demo/admin/ingresos/historial",
  "/demo/teacher",
  "/demo/teacher/rms",
  "/demo/teacher/turnos",
  "/demo/teacher/pagos",
  "/demo/teacher/caja",
  "/demo/student",
  "/demo/student/rms",
  "/demo/student/turnos",
  "/demo/student/beneficios",
  "/demo/personal/student",
  "/demo/personal/student/rms",
  "/demo/personal/student/suscripcion",
];

export default function PreviewDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-demo-root className="min-h-screen flex flex-col bg-black">
      <DemoBanner />
      <DemoNavbar supportedRoutes={supportedRoutes} />
      <DemoScenarioProviders>{children}</DemoScenarioProviders>
    </div>
  );
}
