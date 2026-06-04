"use client";

interface Props {
  joinUrl: string;
  qrSvg: string;
  qrPng: string;
  gymName: string;
  gymLogo: string | null;
  gymSlug: string;
}

export function JoinQrPoster({ joinUrl, qrSvg, qrPng, gymName, gymLogo, gymSlug }: Props) {
  function handlePrint() {
    const logoHtml = gymLogo
      ? `<img src="${gymLogo}" alt="${gymName}" style="max-height:80px;max-width:200px;object-fit:contain;margin-bottom:12px;" />`
      : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>QR Alta — ${gymName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: #fff;
      color: #111;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 40px;
    }
    .card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      max-width: 480px;
      width: 100%;
      border: 2px solid #e5e5e5;
      padding: 48px 40px;
    }
    .gym-name {
      font-size: 28px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      text-align: center;
    }
    .qr-wrap {
      background: #fff;
      padding: 16px;
      border: 1px solid #e5e5e5;
    }
    .qr-wrap svg { display: block; }
    .instruction {
      font-size: 22px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .url {
      font-size: 11px;
      color: #666;
      word-break: break-all;
      text-align: center;
      font-family: monospace;
    }
    @media print {
      body { padding: 0; }
      .card { border: none; padding: 32px; }
    }
  </style>
</head>
<body>
  <div class="card">
    ${logoHtml}
    <p class="gym-name">${gymName}</p>
    <div class="qr-wrap">${qrSvg}</div>
    <p class="instruction">Escaneá para darte de alta</p>
    <p class="url">${joinUrl}</p>
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  function handleDownloadPng() {
    const a = document.createElement("a");
    a.href = qrPng;
    a.download = `qr-alta-${gymSlug}.png`;
    a.click();
  }

  function handleDownloadSvg() {
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-alta-${gymSlug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-line bg-panel p-6 mb-6 flex flex-col gap-4">
      <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
        QR para alta de alumnos
      </p>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* QR card */}
        <div className="flex flex-col items-center gap-3">
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
          <p className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-300 text-center">
            Escaneá para darte de alta
          </p>
          <p className="text-[10px] text-gray-600 font-mono break-all text-center max-w-[320px]">
            {joinUrl}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 sm:justify-center">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-brand-red text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="px-4 py-2 bg-elev border border-edge text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:border-brand-red/50 transition-colors duration-200"
          >
            Descargar PNG
          </button>
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="px-4 py-2 bg-elev border border-edge text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:border-brand-red/50 transition-colors duration-200"
          >
            Descargar SVG
          </button>
        </div>
      </div>
    </div>
  );
}
