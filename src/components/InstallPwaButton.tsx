"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
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

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  }, [deferredPrompt]);

  if (isInstalled) return null;

  return (
    <div className="border border-line bg-panel p-4 mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
            Instalar WODY
          </p>
          <p className="text-xs text-gray-500 font-body">
            Accede mas rapido desde tu pantalla de inicio
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleInstall}>
          Instalar
        </Button>
      </div>

      {showInstructions && !deferredPrompt && (
        <div className="border-t border-line pt-3 flex flex-col gap-2">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400">
            Como instalar
          </p>
          <ul className="flex flex-col gap-1.5 text-xs text-gray-500 font-body">
            <li>
              <span className="text-white font-semibold">Chrome / Edge:</span>{" "}
              Toca el icono de instalar en la barra de direcciones, o Menu → Instalar app
            </li>
            <li>
              <span className="text-white font-semibold">Safari (iPhone):</span>{" "}
              Toca el boton Compartir → Agregar a pantalla de inicio
            </li>
            <li>
              <span className="text-white font-semibold">Android:</span>{" "}
              Menu (3 puntos) → Agregar a pantalla de inicio
            </li>
          </ul>
          <button
            onClick={() => setShowInstructions(false)}
            className="self-start text-xs text-gray-600 hover:text-gray-400 font-heading uppercase tracking-[0.1em] mt-1 cursor-pointer transition-colors duration-200"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
