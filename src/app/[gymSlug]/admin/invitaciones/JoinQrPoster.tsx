"use client";

import { useState } from "react";

interface Props {
  joinUrl: string;
  qrSvg: string;
  qrPng: string;
  gymName: string;
  gymLogo: string | null;
  gymSlug: string;
}

export function JoinQrPoster({ joinUrl, qrSvg, qrPng, gymName, gymLogo, gymSlug }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownloadPdf() {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Logo
      if (gymLogo) {
        try {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const logoH = 20;
                const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
                const logoX = (pageWidth - logoW) / 2;
                doc.addImage(img, "PNG", logoX, y, logoW, logoH);
                y += logoH + 8;
              } catch {
                // logo format not supported (e.g. SVG/WebP) — skip silently
              } finally {
                resolve();
              }
            };
            img.onerror = () => resolve();
            img.src = gymLogo;
          });
        } catch {
          // logo failed — skip silently
        }
      }

      // Gym name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(gymName.toUpperCase(), pageWidth / 2, y, { align: "center" });
      y += 12;

      // QR image (90mm × 90mm, centered)
      const qrSize = 90;
      const qrX = (pageWidth - qrSize) / 2;
      doc.addImage(qrPng, "PNG", qrX, y, qrSize, qrSize);
      y += qrSize + 8;

      // Instruction text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Escaneá para darte de alta", pageWidth / 2, y, { align: "center" });
      y += 10;

      // URL
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(joinUrl, pageWidth / 2, y, { align: "center" });

      doc.save(`qr-alta-${gymSlug}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line bg-panel p-6 mb-6 flex flex-col gap-4">
      <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
        QR para alta de alumnos
      </p>

      <div className="flex flex-col items-center gap-3 max-w-sm mx-auto w-full text-center">
        {gymLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gymLogo}
            alt={gymName}
            className="max-h-12 max-w-[160px] object-contain"
          />
        )}
        <p className="text-sm font-heading font-black uppercase tracking-[0.08em] text-white">
          {gymName}
        </p>
        <div
          className="bg-white p-4"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
          aria-label={`Código QR para darse de alta en ${gymName}`}
        />
        <p className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-300">
          Escaneá para darte de alta
        </p>
        <p className="text-[10px] text-gray-600 font-mono break-all max-w-[320px]">
          {joinUrl}
        </p>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={loading}
          className="mt-2 px-4 py-2 bg-brand-red text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200 disabled:opacity-60"
        >
          {loading ? "Generando..." : "Descargar PDF"}
        </button>
      </div>
    </div>
  );
}
