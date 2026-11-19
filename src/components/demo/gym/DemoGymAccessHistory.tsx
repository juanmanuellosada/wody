"use client";

import { useMemo } from "react";
import { AccessHistoryTable } from "@/components/access/AccessHistoryTable";
import type { AccessHistoryRow as AccessHistoryViewRow } from "@/components/access/access-view-contracts";
import { applyGymAccessProfileOverrides, isGymAccessInstant, projectGymAccessHistory } from "@/components/demo/access/gym-access-demo-state";
import type { GymAccessHistoryRow, GymAccessProfileOverride } from "@/components/demo/access/gym-access-demo-types";
import { GYM_DEMO_ADMIN_ID, getGymDemoActorToken, getGymDemoProfile } from "@/components/demo/scenarios/gym-demo-directory";
import { useDemoGymAccess } from "./DemoGymAccessProvider";
import { useDemoGymFinance } from "./DemoGymFinanceProvider";
import { useDemoGymProfile } from "./DemoGymProfileProvider";

/** A malformed local row is shown as a warning rather than silently omitted from history. */
function mapHistory(rows: GymAccessHistoryRow[] | null): AccessHistoryViewRow[] | null {
  if (!rows || !Array.isArray(rows)) return null;
  const mapped = rows.map((row) => {
    if (
      (row.state !== "PENDING" && row.state !== "GRANTED" && row.state !== "DENIED")
      || row.user === null
      || typeof row.user.id !== "string"
      || typeof row.user.name !== "string"
      || !Number.isSafeInteger(row.user.memberNumber)
      || row.user.memberNumber < 1
      || !isGymAccessInstant(row.at)
      || (row.decidedAt !== null && !isGymAccessInstant(row.decidedAt))
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

/** Display-only overlay for the two profile-bridge-governed fields, built exactly as DemoGymFeesAdapter builds its own. */
function useGymAccessProfileOverrides(): ReadonlyMap<string, GymAccessProfileOverride> {
  const { profileState } = useDemoGymProfile();
  return useMemo(() => new Map(
    profileState.students.map((student) => [student.id, { blocked: student.blockedAt !== null, paymentExempt: student.paymentExempt }]),
  ), [profileState]);
}

export function DemoGymAccessHistory() {
  const access = useDemoGymAccess();
  const finance = useDemoGymFinance();
  const profileOverrides = useGymAccessProfileOverrides();
  const actorToken = useMemo(() => getGymDemoActorToken(GYM_DEMO_ADMIN_ID), []);
  const operatorName = useMemo(() => getGymDemoProfile(GYM_DEMO_ADMIN_ID)?.name ?? null, []);
  const rows = useMemo(() => mapHistory(projectGymAccessHistory(
    access.state,
    actorToken,
    applyGymAccessProfileOverrides(finance.getAccessStudents(), profileOverrides),
    operatorName,
  )), [access.state, actorToken, finance, operatorName, profileOverrides]);

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
