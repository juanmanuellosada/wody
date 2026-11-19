"use client";

import { useMemo } from "react";
import { AccessHistoryTable } from "@/components/access/AccessHistoryTable";
import type { AccessHistoryRow as AccessHistoryViewRow } from "@/components/access/access-view-contracts";
import { financeCatalogSaleActors } from "../finance/catalog-sales-contract";
import { useDemoFinance } from "../finance/DemoFinanceProvider";
import { isAccessInstant, projectAccessHistory } from "./access-demo-state";
import type { AccessHistoryRow } from "./access-demo-types";
import { useDemoAccess } from "./DemoAccessProvider";

/** A malformed local row is shown as a warning rather than silently omitted from history. */
function mapHistory(rows: AccessHistoryRow[] | null): AccessHistoryViewRow[] | null {
  if (!rows || !Array.isArray(rows)) return null;
  const mapped = rows.map((row) => {
    if (
      (row.state !== "PENDING" && row.state !== "GRANTED" && row.state !== "DENIED")
      || row.user === null
      || typeof row.user.id !== "string"
      || typeof row.user.name !== "string"
      || !Number.isSafeInteger(row.user.memberNumber)
      || row.user.memberNumber < 1
      || !isAccessInstant(row.at)
      || (row.decidedAt !== null && !isAccessInstant(row.decidedAt))
      || (row.decidedByName !== null && typeof row.decidedByName !== "string")
    ) return null;
    return {
      id: row.id,
      at: row.at,
      state: row.state,
      decidedAt: row.decidedAt,
      user: { id: row.user.id, name: row.user.name, memberNumber: row.user.memberNumber },
      decidedBy: row.decidedByName === null ? null : { name: row.decidedByName },
    } satisfies AccessHistoryViewRow;
  });
  if (mapped.some((row) => row === null)) return null;
  return mapped as AccessHistoryViewRow[];
}

export function DemoAccessHistory() {
  const access = useDemoAccess();
  const finance = useDemoFinance();
  const rows = useMemo(() => mapHistory(projectAccessHistory(
    access.state,
    financeCatalogSaleActors.admin,
    finance.getAccessStudents(),
  )), [access.state, finance]);

  if (!finance.ready || !access.ready) {
    return <p className="text-sm text-gray-500 font-body italic" role="status">Cargando historial de demostración…</p>;
  }
  if (!rows) {
    return <p className="text-sm text-brand-red font-body" role="alert">No se pudo mostrar el historial de ingresos de demostración.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {access.warning && <p className="text-xs text-yellow-400 font-body" role="alert">{access.warning}</p>}
      <AccessHistoryTable logs={rows} />
    </div>
  );
}
