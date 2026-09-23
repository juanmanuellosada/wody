"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  decideCheckin,
  lookupForKiosk,
  createManualCheckin,
} from "@/actions/access";
import { getTodayArgentina, toInputDate } from "@/lib/dates";
import { AccessKioskView } from "./AccessKioskView";
import type {
  AccessPendingLog,
  AccessRecentLog,
} from "./access-view-contracts";

interface KioskViewProps {
  gymSlug: string;
  initialQrSvg: string;
  initialQrExpiresInMs: number;
}

export function KioskView({
  gymSlug,
  initialQrSvg,
  initialQrExpiresInMs,
}: KioskViewProps) {
  const router = useRouter();
  const [qrSvg, setQrSvg] = useState(initialQrSvg);
  const [pending, setPending] = useState<AccessPendingLog[]>([]);
  const [recent, setRecent] = useState<AccessRecentLog[]>([]);
  const todayStr = toInputDate(getTodayArgentina());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;
  // Toast que aparece cuando llega un ingreso nuevo (escaneo o manual).
  // Se muestra 3s y se va. Acknowledgeamos el último id visto para no
  // re-disparar el toast en cada poll.
  const [toast, setToast] = useState<AccessRecentLog | null>(null);
  const lastSeenRecentIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresca el QR cuando el bucket cambia. Pedimos un re-render del
  // server component con router.refresh() y leemos el nuevo SVG via
  // props en el próximo render.
  useEffect(() => {
    const timer = setTimeout(
      () => router.refresh(),
      initialQrExpiresInMs + 100,
    );
    return () => clearTimeout(timer);
  }, [initialQrExpiresInMs, router]);

  useEffect(() => {
    setQrSvg(initialQrSvg);
  }, [initialQrSvg]);

  // Reset del toast tracker al cambiar de día: evita que al volver a hoy
  // flashee un toast con el último ingreso pre-existente.
  useEffect(() => {
    lastSeenRecentIdRef.current = null;
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, [selectedDate]);

  // Polling del feed cada 2s.
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(
          `/api/ingresos/pending?date=${encodeURIComponent(selectedDate)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          pending: AccessPendingLog[];
          recent: AccessRecentLog[];
        };
        if (cancelled) return;
        setPending(data.pending);
        setRecent(data.recent);

        // Toast: si el primero de recientes es distinto al último que
        // vimos (y NO es el primer tick), flasheamos. Evita disparar
        // en el primer load para no popear toast de entradas viejas.
        // Solo tiene sentido al mirar el día de hoy (en días pasados
        // la lista no cambia en tiempo real).
        if (isToday && data.recent.length > 0) {
          const latest = data.recent[0];
          if (
            lastSeenRecentIdRef.current !== null &&
            lastSeenRecentIdRef.current !== latest.id
          ) {
            setToast(latest);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setToast(null), 3000);
          }
          lastSeenRecentIdRef.current = latest.id;
        }
      } catch {
        /* ignore transient errors */
      }
    }

    tick();
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [gymSlug, selectedDate, isToday]);

  return (
    <AccessKioskView
      qrDescription="Escaneá este QR desde la app de WODY para registrar el ingreso. El código rota cada 5 minutos."
      qrSlot={
        <div
          className="bg-white p-4 self-start"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
          aria-label="QR para check-in"
        />
      }
      pending={pending}
      recent={recent}
      toast={toast}
      selectedDate={selectedDate}
      todayStr={todayStr}
      isToday={isToday}
      onSelectedDateChange={setSelectedDate}
      onDecideCheckin={decideCheckin}
      onLookupForKiosk={lookupForKiosk}
      onCreateManualCheckin={createManualCheckin}
    />
  );
}
