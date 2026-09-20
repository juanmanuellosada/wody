"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { PaymentControlView } from "@/components/payments/PaymentControlView";
import { StudentTypeSelectView } from "@/components/StudentTypeSelectView";
import { Button } from "@/components/ui/Button";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import {
  getFeeBlockStatus,
  projectFeeStudents,
  selectFeeStudents,
  type FeeRole,
  type FeeStatusFilter,
  type FeeStudent,
  type FeeStudentType,
} from "./fees-contract";
import { demoFeeIdentities, getDemoFeeFixtures } from "./fees-fixtures";

const statusKeys: FeeStatusFilter[] = ["all", "overdue", "due-soon", "ok", "exempt"];

function subscribeToDemoDate() {
  return () => {};
}

function readDemoToday(): string {
  return toInputDate(getTodayArgentina());
}

function readStaticDemoToday(): null {
  return null;
}

function DemoFeeActions({ role }: { role: FeeRole }) {
  return (
    <>
      <Button variant="ghost" size="sm" disabled title="La edición de perfiles no está disponible en esta demostración.">
        Editar
      </Button>
      {role === "ADMIN" && (
        <Button variant="ghost" size="sm" disabled title="El bloqueo no está disponible en esta demostración.">
          Bloquear
        </Button>
      )}
    </>
  );
}

/** Client-only demo adapter: it owns fictional state and never writes a profile or financial record. */
export function DemoFeesAdapter({ role }: { role: FeeRole }) {
  // Static exports must not bake relative fee dates into HTML or hydrate different dates.
  const today = useSyncExternalStore(subscribeToDemoDate, readDemoToday, readStaticDemoToday);
  const [activeFilter, setActiveFilter] = useState<FeeStatusFilter>("all");
  const [activeType, setActiveType] = useState<FeeStudentType | "">("");

  const activeStudents = useMemo(() => {
    if (!today) return [] as FeeStudent[];
    return selectFeeStudents(getDemoFeeFixtures(today), demoFeeIdentities[role === "ADMIN" ? "admin" : "teacher"]);
  }, [role, today]);
  const projection = useMemo(
    () => today ? projectFeeStudents(activeStudents, today, activeFilter, activeType) : null,
    [activeFilter, activeStudents, activeType, today],
  );

  if (!today || !projection) {
    return (
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <p className="text-sm text-gray-500 font-body italic">Preparando datos ficticios de cuotas…</p>
      </main>
    );
  }

  const rows = projection.rows.map((row) => ({
    ...row,
    blockStatus: getFeeBlockStatus(row, today, 45),
  }));
  const rowActions = Object.fromEntries(rows.map((row) => [row.id, <DemoFeeActions key={row.id} role={role} />]));
  const hasAnyStudents = activeStudents.length > 0;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <PaymentControlView
        rows={rows}
        counts={projection.counts}
        activeFilter={activeFilter}
        typeControl={(
          <StudentTypeSelectView
            gymKind="BOX"
            value={activeType}
            onChange={(next) => setActiveType(next as FeeStudentType | "")}
          />
        )}
        statusTiles={statusKeys.map((key) => ({ key, onSelect: () => setActiveFilter(key) }))}
        emptyMessage={hasAnyStudents ? "No hay alumnos en este estado." : role === "ADMIN" ? "No hay alumnos cargados todavía." : "No tenés alumnos asignados."}
        rowActions={rowActions}
        notice={(
          <p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">
            Datos ficticios. Editar, bloquear, eximir y asignar alumnos no están disponibles en esta demostración y no modifican perfiles.
          </p>
        )}
      />
    </main>
  );
}
