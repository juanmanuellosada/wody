import QRCode from "qrcode";
import { qrPayload } from "@/lib/qr";
import { formatMemberNumber } from "@/lib/memberNumber";
import { RegenerateQrButton } from "./RegenerateQrButton";

interface StudentQrCardProps {
  userId: string;
  memberNumber: number;
  qrToken: string;
  gymSlug: string;
}

// Tarjeta para el dashboard del alumno: muestra su número de socio +
// el QR renderizado como SVG inline + botón para regenerar. El QR se
// escanea en la pantalla de ingresos del gym.
export async function StudentQrCard({
  userId,
  memberNumber,
  qrToken,
  gymSlug,
}: StudentQrCardProps) {
  const payload = qrPayload(gymSlug, qrToken);
  const svg = await QRCode.toString(payload, {
    type: "svg",
    margin: 2,
    width: 220,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="border border-line bg-panel p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-500">
          Tu acceso
        </p>
        <p className="text-sm font-heading font-bold text-white tabular-nums tracking-[0.1em]">
          Socio Nº {formatMemberNumber(memberNumber)}
        </p>
      </div>
      <div
        className="bg-white p-3 self-center"
        dangerouslySetInnerHTML={{ __html: svg }}
        aria-label="Tu código QR de acceso"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 font-body">
          Mostralo en la recepción al ingresar.
        </p>
        <RegenerateQrButton userId={userId} scope="self" />
      </div>
    </div>
  );
}
