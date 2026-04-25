import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import {
  DemoIngresosView,
  parseDemoIngresosFilter,
} from "@/components/demo/DemoIngresosView";
import { getDemoIngresosRows } from "@/components/demo/demoIngresosData";

export const metadata: Metadata = {
  title: "WODY — Demo Ingresos (Admin)",
};

interface Props {
  searchParams: Promise<{ estado?: string }>;
}

export default async function DemoAdminIngresosPage({ searchParams }: Props) {
  const { estado } = await searchParams;
  const activeFilter = parseDemoIngresosFilter(estado);
  const rows = getDemoIngresosRows();

  return (
    <>
      <DemoNavbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <DemoIngresosView
          rows={rows}
          basePath="/demo/admin/ingresos"
          activeFilter={activeFilter}
        />
      </main>
    </>
  );
}
