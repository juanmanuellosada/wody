import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import {
  DemoPagosView,
  parseDemoFilter,
} from "@/components/demo/DemoPagosView";
import {
  demoTeachers,
  getDemoPagosRows,
} from "@/components/demo/demoPagosData";

export const metadata: Metadata = {
  title: "WODY — Demo Pagos (Admin)",
};

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function DemoAdminPagosPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const activeFilter = parseDemoFilter(status);
  const rows = getDemoPagosRows();

  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <DemoPagosView
          rows={rows}
          allTeachers={demoTeachers}
          basePath="/demo/admin/pagos"
          activeFilter={activeFilter}
          emptyMessage="No hay alumnos cargados todavía."
        />
      </main>
    </>
  );
}
