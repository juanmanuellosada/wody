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
  title: "WODY — Demo Pagos (Profe)",
};

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const TEACHER_ID = "t1";

export default async function DemoTeacherPagosPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const activeFilter = parseDemoFilter(status);
  const rows = getDemoPagosRows().filter((r) =>
    r.assignedTeachers.some((t) => t.id === TEACHER_ID)
  );

  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <DemoPagosView
          rows={rows}
          allTeachers={demoTeachers}
          basePath="/demo/teacher/pagos"
          activeFilter={activeFilter}
          emptyMessage="No tenés alumnos asignados."
        />
      </main>
    </>
  );
}
