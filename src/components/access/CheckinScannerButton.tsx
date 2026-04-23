"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CheckinScannerButtonProps {
  gymSlug: string;
}

// Abre la cámara del dispositivo dentro de la PWA y escanea el QR del
// kiosk. Al detectar una URL válida del mismo gym, navega in-PWA a
// /checkin?t=... (scope incluye todo, así que queda dentro). Evita el
// rebote al browser del sistema que pasa cuando se escanea con la app
// Cámara nativa.
export function CheckinScannerButton({ gymSlug }: CheckinScannerButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // `IScannerControls` vive en @zxing/browser; lo tipamos suelto para no
  // traer el tipo al bundle principal (la lib se importa dinámico).
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  // Un QR detectado ya fue manejado — no procesamos más. Previene que el
  // loop de zxing dispare handleDetected varias veces antes de que alcancemos
  // a stopScan y navegar.
  const detectedRef = useRef(false);

  const stopScan = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    // Cerramos explícitamente los tracks del stream por si zxing dejó
    // alguno abierto (iOS a veces se confunde si la cámara sigue activa
    // durante la navegación).
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopScan();
      return;
    }

    let cancelled = false;
    detectedRef.current = false;
    setStarting(true);
    setError(null);

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        if (!videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!result || detectedRef.current) return;
            detectedRef.current = true;
            handleDetected(result.getText());
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "No se pudo abrir la cámara.";
        setError(msg);
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleDetected(text: string) {
    try {
      const url = new URL(text);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      if (url.origin !== origin) {
        detectedRef.current = false;
        setError("Este QR no pertenece a WODY.");
        return;
      }
      const expected = `/${gymSlug}/checkin`;
      if (!url.pathname.startsWith(expected)) {
        detectedRef.current = false;
        setError("El QR es de otro gym.");
        return;
      }
      // Paramos el stream primero y después navegamos. iOS a veces
      // renderiza raro si la cámara sigue activa durante la nav.
      stopScan();
      setOpen(false);
      window.location.href = url.pathname + url.search;
    } catch {
      detectedRef.current = false;
      setError("El QR no contiene una URL válida.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 w-full bg-brand-red text-white font-heading font-bold uppercase tracking-[0.15em] text-sm py-4 px-6 min-h-[56px] hover:bg-brand-red-dark transition-colors duration-200 cursor-pointer"
      >
        <Camera size={18} aria-hidden="true" />
        Escanear ingreso
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Escanear QR del gym"
        >
          <div className="bg-panel border border-edge w-full max-w-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-white">
                Escaneá el QR del gym
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-white transition-colors duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="relative bg-black aspect-square">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 font-body">
                  Iniciando cámara...
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col gap-3">
              {error ? (
                <p
                  className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
                  role="alert"
                >
                  {error}
                </p>
              ) : (
                <p className="text-xs text-gray-500 font-body text-center">
                  Apuntá al QR que muestra la recepción.
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
