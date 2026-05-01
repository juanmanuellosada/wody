import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { gymPath, hasAccessControl, isPersonalGym } from "@/lib/gym";
import { generateCheckinToken, msUntilNextBucket } from "@/lib/checkin";
import { KioskView } from "@/components/access/KioskView";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

// Página del kiosk. Server-side rinde el QR inicial (SVG). El cliente se
// encarga del polling de pendings/recientes y de refrescar el QR cada
// vez que el bucket cambia (cada 5 min).
export default async function IngresosPage({ params }: Props) {
  const { gymSlug } = await params;
  if (!hasAccessControl(gymSlug)) notFound();
  const session = await auth();

  if (session?.user && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (
    !session?.user ||
    (session.user.role !== "ACCESS" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  let svg: string;
  let expiresInMs: number;
  try {
    const token = generateCheckinToken(gymSlug);
    const checkinUrl = `${origin}${gymPath(gymSlug, `/checkin?t=${encodeURIComponent(token)}`)}`;
    svg = await QRCode.toString(checkinUrl, {
      type: "svg",
      margin: 2,
      width: 280,
      errorCorrectionLevel: "M",
    });
    expiresInMs = msUntilNextBucket();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return (
      <div className="border border-brand-red/40 bg-brand-red/5 p-6 flex flex-col gap-3">
        <h1 className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white">
          No pudimos generar el QR
        </h1>
        <p className="text-sm text-gray-400 font-body">{message}</p>
        <p className="text-xs text-gray-500 font-body">
          Verificá que la env var <code>CHECKIN_TOKEN_SECRET</code> esté
          definida en Vercel y redeployá.
        </p>
      </div>
    );
  }

  return (
    <KioskView
      gymSlug={gymSlug}
      initialQrSvg={svg}
      initialQrExpiresInMs={expiresInMs}
    />
  );
}
