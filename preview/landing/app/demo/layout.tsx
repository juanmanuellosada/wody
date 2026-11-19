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
  "/demo/student/wod",
  "/demo/student/turnos",
  "/demo/student/beneficios",
  "/demo/personal/student",
  "/demo/personal/student/rms",
  "/demo/personal/student/timers",
  "/demo/personal/student/beneficios",
  "/demo/personal/student/suscripcion",
  "/demo/gym/admin",
  "/demo/gym/admin/pagos",
  "/demo/gym/admin/caja",
  "/demo/gym/admin/productos",
  "/demo/gym/admin/ingresos",
  "/demo/gym/admin/ingresos/historial",
  "/demo/gym/admin/turnos",
  "/demo/gym/admin/rms",
  "/demo/gym/teacher",
  "/demo/gym/teacher/pagos",
  "/demo/gym/teacher/caja",
  "/demo/gym/teacher/rms",
  "/demo/gym/teacher/turnos",
  "/demo/gym/student",
  "/demo/gym/student/rms",
  "/demo/gym/student/wod",
  "/demo/gym/student/turnos",
  "/demo/gym/student/beneficios",
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
