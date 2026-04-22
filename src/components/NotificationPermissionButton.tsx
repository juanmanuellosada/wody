"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { savePushSubscription } from "@/actions/push";

// Converts the VAPID public key (base64url) into an ArrayBuffer,
// which pushManager.subscribe accepts as applicationServerKey.
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
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
        const res = await savePushSubscription({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
        setSyncState(res.success ? "synced" : "missing");
      } catch {
        setSyncState("missing");
      }
    })();
  }, []);

  const handleEnable = useCallback(async () => {
    setError(null);
    setBusy(true);
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
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey),
        });
      }

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("La suscripción no devolvió las claves esperadas.");
      }

      const res = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!res.success) throw new Error(res.error);
      setSyncState("synced");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!supported) return null;
  // Don't render while we check if there's an existing sub to upsert —
  // prevents a "Activar" flash for users already set up.
  if (permission === "granted" && syncState === "unknown") return null;
  if (permission === "granted" && syncState === "synced") return null;

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
