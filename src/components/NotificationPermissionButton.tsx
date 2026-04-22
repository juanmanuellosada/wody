"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";

// POSTea la sub al endpoint REST /api/notifications/subscribe.
// Usamos un route handler en vez del server action porque fue más confiable
// en Safari iOS (encoding de form actions tiene ediciones raras en Webkit).
async function saveSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/notifications/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: message };
  }
  return { ok: true };
}

// Converts the VAPID public key (base64url) into a Uint8Array.
// Safari iOS ha tenido distintos quirks con BufferSource vs string, así que
// intentamos primero con string (DOMString, permitido por el spec de Push API
// y soportado por Safari 16.4+) y fallback a Uint8Array si falla.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function subscribeWithKey(
  registration: ServiceWorkerRegistration,
  publicKey: string
): Promise<PushSubscription> {
  // Intento 1: pasar el base64url como string (spec-compliant, más simple).
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey as unknown as BufferSource,
    });
  } catch (e1) {
    // Intento 2: Uint8Array decodificada.
    try {
      return await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (e2) {
      // Re-throw con ambos mensajes para debug.
      const m1 = e1 instanceof Error ? e1.message : String(e1);
      const m2 = e2 instanceof Error ? e2.message : String(e2);
      throw new Error(
        `Subscribe falló. string: "${m1}". Uint8Array: "${m2}". Key length: ${publicKey.length}.`
      );
    }
  }
}

type SyncState = "unknown" | "synced" | "missing";

export function NotificationPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [syncState, setSyncState] = useState<SyncState>("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: detect support + current permission, and if granted, try to
  // resync an existing subscription with the server (idempotent upsert).
  // This covers the case where a past subscribe call succeeded in the OS
  // but the POST to our server never made it (first-launch glitch, iOS
  // flakiness, etc.) — without this, the button would hide and there'd
  // be no way to recover.
  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

    if (currentPermission !== "granted") return;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!existing) {
          setSyncState("missing");
          return;
        }
        const json = existing.toJSON() as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setSyncState("missing");
          return;
        }
        const res = await saveSubscription({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
        setSyncState(res.ok ? "synced" : "missing");
      } catch {
        setSyncState("missing");
      }
    })();
  }, []);

  const handleEnable = useCallback(async () => {
    setError(null);
    setBusy(true);
    // Fuerza el syncState a "missing" mientras corre el flujo para que el
    // render no desmonte el componente cuando Notification.requestPermission
    // devuelve "granted" y pega el re-render.
    setSyncState("missing");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Falta la VAPID public key.");

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setBusy(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await subscribeWithKey(registration, publicKey);
      }

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("La suscripción no devolvió las claves esperadas.");
      }

      const res = await saveSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!res.ok) throw new Error(res.error ?? "No se pudo guardar la sub.");
      setSyncState("synced");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!supported) return null;
  // While we're doing work (permission prompt, subscribe, POST) always
  // render so errors have a place to appear. Without this, a mid-flow
  // setPermission("granted") would unmount the component and any later
  // setError would be lost.
  if (!busy) {
    if (permission === "granted" && syncState === "unknown") return null;
    if (permission === "granted" && syncState === "synced") return null;
  }

  return (
    <div className="border border-line bg-panel p-4 mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
            Activar notificaciones
          </p>
          <p className="text-xs text-gray-500 font-body">
            Te avisamos 3 días antes y el día que vence tu cuota.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleEnable}
          loading={busy}
          disabled={permission === "denied"}
          title={
            permission === "denied"
              ? "Bloqueado por el navegador — habilitalo desde la configuración del sitio"
              : undefined
          }
        >
          {permission === "denied" ? "Bloqueadas" : "Activar"}
        </Button>
      </div>
      {error && (
        <p
          className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
