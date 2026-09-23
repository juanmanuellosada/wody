"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessKioskView } from "@/components/access/AccessKioskView";
import type { AccessPendingLog, AccessRecentLog } from "@/components/access/access-view-contracts";
import { financeCatalogSaleActors } from "../finance/catalog-sales-contract";
import { useDemoFinance } from "../finance/DemoFinanceProvider";
import { isAccessDate, isAccessInstant, projectAccessDailyFeed } from "./access-demo-state";
import type { AccessDailyFeed, AccessHistoryRow, AccessUserDto } from "./access-demo-types";
import { useDemoAccess } from "./DemoAccessProvider";

type KioskFeed = { pending: AccessPendingLog[]; recent: AccessRecentLog[] };

function validUser(user: AccessHistoryRow["user"]): user is AccessUserDto {
  return user !== null
    && typeof user.id === "string"
    && typeof user.name === "string"
    && user.role === "STUDENT"
    && Number.isSafeInteger(user.memberNumber)
    && user.memberNumber > 0
    && isAccessDate(user.nextPaymentDate)
    && (user.blockedAt === null || isAccessInstant(user.blockedAt));
}

/** Never filter a projection: an invalid DTO makes the whole local view visibly unavailable. */
function mapFeed(feed: AccessDailyFeed | null): KioskFeed | null {
  if (!feed || !isAccessDate(feed.date) || !Array.isArray(feed.pending) || !Array.isArray(feed.recent)) return null;

  const pending: AccessPendingLog[] = [];
  for (const log of feed.pending) {
    if (log.state !== "PENDING" || !validUser(log.user) || typeof log.id !== "string" || !isAccessInstant(log.at)) return null;
    pending.push({
      id: log.id,
      at: log.at,
      user: {
        id: log.user.id,
        name: log.user.name,
        role: log.user.role,
        memberNumber: log.user.memberNumber,
        nextPaymentDate: log.user.nextPaymentDate,
        blockedAt: log.user.blockedAt,
      },
    });
  }
  const recent: AccessRecentLog[] = [];
  for (const log of feed.recent) {
    if (
      (log.state !== "GRANTED" && log.state !== "DENIED")
      || !validUser(log.user)
      || typeof log.id !== "string"
      || !isAccessInstant(log.at)
      || (log.decidedAt !== null && !isAccessInstant(log.decidedAt))
    ) return null;
    recent.push({
      id: log.id,
      at: log.at,
      state: log.state,
      decidedAt: log.decidedAt,
      user: { id: log.user.id, name: log.user.name, memberNumber: log.user.memberNumber },
    });
  }
  return { pending, recent };
}

export function DemoAccessKiosk() {
  const access = useDemoAccess();
  const finance = useDemoFinance();

  if (!finance.ready || !access.ready || !access.callbacks) {
    return <p className="text-sm text-gray-500 font-body italic" role="status">Cargando ingresos de demostración…</p>;
  }

  return <DemoAccessKioskContent key={access.resetEpoch} />;
}

function DemoAccessKioskContent() {
  const access = useDemoAccess();
  const finance = useDemoFinance();
  const callbacks = access.callbacks!;
  const [selectedDate, setSelectedDate] = useState(finance.today);
  const [toast, setToast] = useState<AccessRecentLog | null>(null);
  const lastSeenRecentIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isToday = selectedDate === finance.today;

  const feed = useMemo(() => mapFeed(projectAccessDailyFeed(
    access.state,
    financeCatalogSaleActors.admin,
    finance.getAccessStudents(),
    selectedDate,
    new Date().toISOString(),
  )), [access.state, finance, selectedDate]);
  const latestRecent = feed?.recent[0] ?? null;
  const latestRecentId = latestRecent?.id ?? null;

  useEffect(() => {
    if (!isToday || !latestRecentId || !latestRecent) return;
    const latest = latestRecent;
    if (lastSeenRecentIdRef.current !== null && lastSeenRecentIdRef.current !== latestRecentId) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      const showTimer = setTimeout(() => {
        setToast(latest);
        toastTimerRef.current = setTimeout(() => setToast(null), 3000);
      }, 0);
      lastSeenRecentIdRef.current = latestRecentId;
      return () => window.clearTimeout(showTimer);
    }
    lastSeenRecentIdRef.current = latestRecentId;
  }, [isToday, latestRecent, latestRecentId]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  if (!feed) {
    return <p className="text-sm text-brand-red font-body" role="alert">No se pudo mostrar el estado de ingresos de demostración.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {access.warning && <p className="text-xs text-yellow-400 font-body" role="alert">{access.warning}</p>}
      <AccessKioskView
        qrDescription="El flujo manual de demostración es funcional: buscá al socio por número o email para decidir el ingreso."
        qrSlot={<div className="border border-line bg-panel px-4 py-6 text-center text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500" aria-label="QR simulado no operativo">QR simulado — no operativo</div>}
        pending={feed.pending}
        recent={feed.recent}
        toast={toast}
        selectedDate={selectedDate}
        todayStr={finance.today}
        isToday={isToday}
        onSelectedDateChange={(date) => {
          if (!isAccessDate(date)) return;
          lastSeenRecentIdRef.current = null;
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          setToast(null);
          setSelectedDate(date);
        }}
        onDecideCheckin={callbacks.decideCheckin}
        onLookupForKiosk={callbacks.lookupForKiosk}
        onCreateManualCheckin={callbacks.createManualCheckin}
      />
      <div className="flex flex-wrap items-center gap-4 text-xs font-heading font-bold uppercase tracking-[0.15em]">
        <Link href="/demo/admin/ingresos/historial/" className="text-gray-400 hover:text-white">Ver historial</Link>
        <button type="button" onClick={access.reset} className="text-gray-500 hover:text-white">Restablecer ingresos</button>
      </div>
    </div>
  );
}
