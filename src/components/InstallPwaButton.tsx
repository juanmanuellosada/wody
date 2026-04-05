"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(true); // default true to avoid flash

  useEffect(() => {
    // Check if already running as PWA (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    setIsInstalled(false);

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }

  // Don't show if already installed or no prompt available
  if (isInstalled) return null;

  return (
    <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
          Instalar WODY
        </p>
        <p className="text-xs text-gray-500 font-body">
          Accede mas rapido desde tu pantalla de inicio
        </p>
      </div>
      {deferredPrompt ? (
        <Button variant="primary" size="sm" onClick={handleInstall}>
          Instalar
        </Button>
      ) : (
        <p className="text-xs text-gray-600 font-body">
          Usa &quot;Agregar a inicio&quot; en tu navegador
        </p>
      )}
    </div>
  );
}
