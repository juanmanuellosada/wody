"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

type State = "PENDING" | "GRANTED" | "DENIED" | "EXPIRED";

interface CheckinStatusPollerProps {
  logId: string;
  initialState: "PENDING" | "GRANTED";
  userName: string;
  backHref: string;
}

// Pollea /api/checkin/status/:id cada 1.5s hasta que el estado deje de
// ser PENDING. Si llega a EXPIRED (5 min sin respuesta) se muestra el
// mensaje de timeout.
export function CheckinStatusPoller({
  logId,
  initialState,
  userName,
  backHref,
}: CheckinStatusPollerProps) {
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    if (state !== "PENDING") return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/checkin/status/${logId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { state: State };
        if (cancelled) return;
        if (data.state !== "PENDING") setState(data.state);
      } catch {
        /* ignore transient errors */
      }
    }

    tick();
    const interval = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [logId, state]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-black">
      <div className="w-full max-w-sm border border-line bg-panel p-8 flex flex-col gap-4 text-center">
        {state === "GRANTED" && (
          <>
            <CheckCircle2
              className="mx-auto text-green-500"
              size={56}
              aria-hidden="true"
            />
            <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Bienvenido
            </h1>
            <p className="text-sm text-gray-400 font-body">
              {userName.split(" ")[0]}, tu ingreso quedó registrado.
            </p>
          </>
        )}
        {state === "DENIED" && (
          <>
            <XCircle
              className="mx-auto text-brand-red"
              size={56}
              aria-hidden="true"
            />
            <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Acceso no autorizado
            </h1>
            <p className="text-sm text-gray-400 font-body">
              Acercate a recepción.
            </p>
          </>
        )}
        {state === "EXPIRED" && (
          <>
            <AlertTriangle
              className="mx-auto text-yellow-400"
              size={56}
              aria-hidden="true"
            />
            <h1 className="text-xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Se venció la espera
            </h1>
            <p className="text-sm text-gray-400 font-body">
              Escaneá el QR de nuevo.
            </p>
          </>
        )}
        {state === "PENDING" && (
          <>
            <Clock
              className="mx-auto text-gray-400 animate-pulse"
              size={56}
              aria-hidden="true"
            />
            <h1 className="text-xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Esperando confirmación
            </h1>
            <p className="text-sm text-gray-400 font-body">
              Mostrale esta pantalla a recepción.
            </p>
          </>
        )}

        {state !== "PENDING" && (
          <Link
            href={backHref}
            className="mt-2 inline-block px-6 py-3 font-heading font-bold uppercase tracking-[0.15em] text-white text-xs bg-brand-red hover:bg-brand-red-dark transition-colors duration-200"
          >
            Volver
          </Link>
        )}
      </div>
    </main>
  );
}
