import { DemoBanner } from "../../../../src/components/DemoBanner";
import { DemoNavbar } from "../../../../src/components/DemoNavbar";
import { DemoAccessProvider } from "../../../../src/components/demo/access/DemoAccessProvider";
import { DemoFinanceProvider } from "../../../../src/components/demo/finance/DemoFinanceProvider";
import { DemoTrainingProvider } from "../../../../src/components/demo/training/DemoTrainingProvider";

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
];

export default function PreviewDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoTrainingProvider>
      <DemoFinanceProvider>
        <DemoAccessProvider>
          <div data-demo-root className="min-h-screen flex flex-col bg-black">
            <DemoBanner />
            <DemoNavbar supportedRoutes={supportedRoutes} />
            {children}
          </div>
        </DemoAccessProvider>
      </DemoFinanceProvider>
    </DemoTrainingProvider>
  );
}
