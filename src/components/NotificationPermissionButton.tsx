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

export function NotificationPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!supported) return null;
  if (permission === "granted") return null;

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
