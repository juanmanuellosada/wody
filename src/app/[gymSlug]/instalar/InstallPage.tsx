"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Share, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { gymPath } from "@/lib/gym";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState =
  | "loading"
  | "already-installed"
  | "android-prompt"
  | "ios-instructions"
  | "android-manual"
  | "desktop";

interface Props {
  gymSlug: string;
  gymName: string;
}

export function InstallPage({ gymSlug, gymName }: Props) {
  const [state, setState] = useState<InstallState>("loading");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installOutcome, setInstallOutcome] = useState<"accepted" | "dismissed" | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isMobile = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Derive initial state from browser APIs (external system) — sync is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial state sync from window/navigator (external); "loading" default avoids flashing before detection.
    setState(
      isStandalone ? "already-installed"
      : isIOS      ? "ios-instructions"
      : isMobile   ? "android-manual"
      :              "desktop"
    );

    if (isStandalone || isIOS) return;

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState("android-prompt");
    }

    function handleAppInstalled() {
      setState("already-installed");
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
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstallOutcome(outcome);
    if (outcome === "accepted") {
      setState("already-installed");
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const loginLink = gymPath(gymSlug, "/login");

  if (state === "loading") {
    return (
      <div className="bg-panel border border-line p-6 text-center">
        <p className="text-sm text-gray-500 font-body">Detectando tu dispositivo...</p>
      </div>
    );
  }

  if (state === "already-installed") {
    return (
      <div className="bg-panel border border-line p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
            App instalada
          </p>
          <p className="text-sm text-gray-400 font-body">
            {gymName} ya está instalado en este dispositivo.
          </p>
        </div>
        <Link
          href={loginLink}
          className="inline-flex items-center justify-center bg-brand-red text-white font-heading font-bold uppercase tracking-[0.15em] text-sm px-6 py-3 min-h-[44px] transition-all duration-200 hover:bg-brand-red-dark"
        >
          Ingresar a {gymName}
        </Link>
      </div>
    );
  }

  if (state === "android-prompt") {
    return (
      <div className="bg-panel border border-line p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
            Instalá {gymName}
          </p>
          <p className="text-sm text-gray-400 font-body">
            Accedé más rápido desde tu pantalla de inicio, sin abrir el navegador.
          </p>
        </div>
        {installOutcome === "dismissed" && (
          <p className="text-xs text-gray-500 font-body">
            Podés instalarlo cuando quieras desde el menú del navegador.
          </p>
        )}
        <Button variant="primary" size="md" onClick={handleInstall} className="w-full">
          Instalar ahora
        </Button>
      </div>
    );
  }

  if (state === "ios-instructions") {
    return (
      <div className="bg-panel border border-line p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
            Instalá {gymName} en tu iPhone
          </p>
          <p className="text-xs text-gray-500 font-body">
            Seguí estos 3 pasos en Safari para agregar la app a tu pantalla de inicio.
          </p>
        </div>

        <ol className="flex flex-col gap-4">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-red flex items-center justify-center text-xs font-heading font-bold text-white mt-0.5">
              1
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm text-white font-body font-semibold flex items-center gap-2 flex-wrap">
                Tocá el botón Compartir
                <span className="inline-flex items-center justify-center w-7 h-7 border border-gray-600 rounded bg-gray-800 flex-shrink-0">
                  <Share size={14} className="text-blue-400" />
                </span>
              </p>
              <p className="text-xs text-gray-500 font-body">
                Está en la barra inferior de Safari (flecha hacia arriba).
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-red flex items-center justify-center text-xs font-heading font-bold text-white mt-0.5">
              2
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm text-white font-body font-semibold flex items-center gap-2 flex-wrap">
                Tocá &ldquo;Agregar a pantalla de inicio&rdquo;
                <span className="inline-flex items-center justify-center w-7 h-7 border border-gray-600 rounded bg-gray-800 flex-shrink-0">
                  <Plus size={14} className="text-gray-300" />
                </span>
              </p>
              <p className="text-xs text-gray-500 font-body">
                Bajá en el menú hasta encontrar &ldquo;Agregar a pantalla de inicio&rdquo; / &ldquo;Add to Home Screen&rdquo;.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-red flex items-center justify-center text-xs font-heading font-bold text-white mt-0.5">
              3
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-white font-body font-semibold">
                Tocá &ldquo;Agregar&rdquo; arriba a la derecha
              </p>
              <p className="text-xs text-gray-500 font-body">
                La app aparecerá en tu pantalla de inicio como cualquier otra app.
              </p>
            </div>
          </li>
        </ol>
      </div>
    );
  }

  if (state === "android-manual") {
    return (
      <div className="bg-panel border border-line p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
            Instalá {gymName}
          </p>
          <p className="text-xs text-gray-500 font-body">
            Seguí estos pasos según tu navegador.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 border border-line flex items-center justify-center">
              <MoreVertical size={12} className="text-gray-400" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-white font-body font-semibold">Chrome / Edge</p>
              <p className="text-xs text-gray-500 font-body">
                Tocá el menú ⋮ → &ldquo;Instalar app&rdquo; o &ldquo;Agregar a pantalla de inicio&rdquo;.
              </p>
            </div>
          </li>

          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 border border-line flex items-center justify-center text-xs text-gray-400 font-heading font-bold">
              ?
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-white font-body font-semibold">No ves la opción</p>
              <p className="text-xs text-gray-500 font-body">
                Recargá esta página y esperá unos segundos. También podés abrirla en Chrome.
              </p>
            </div>
          </li>
        </ul>
      </div>
    );
  }

  // desktop
  return (
    <div className="bg-panel border border-line p-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">
          Instalá {gymName} en tu computadora
        </p>
        <p className="text-xs text-gray-500 font-body">
          En Chrome y Edge podés instalar la app desde la barra de direcciones.
        </p>
      </div>

      <ul className="flex flex-col gap-2 text-xs text-gray-500 font-body">
        <li>
          <span className="text-white font-semibold">Chrome / Edge:</span>{" "}
          Buscá el ícono de instalación (pantalla con flecha) en la barra de direcciones, o andá a Menú → &ldquo;Instalar {gymName}&rdquo;.
        </li>
        <li>
          <span className="text-white font-semibold">Desde el celular:</span>{" "}
          Abrí este link en tu teléfono para instalarla ahí.
        </li>
      </ul>

      <Link
        href={loginLink}
        className="inline-flex items-center justify-center text-xs text-gray-500 hover:text-gray-300 font-heading uppercase tracking-[0.1em] transition-colors duration-200 self-start"
      >
        Usar en el navegador
      </Link>
    </div>
  );
}
