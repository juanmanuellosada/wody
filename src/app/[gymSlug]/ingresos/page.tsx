import { redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { gymPath } from "@/lib/gym";
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
  const session = await auth();

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

  const token = generateCheckinToken(gymSlug);
  const checkinUrl = `${origin}${gymPath(gymSlug, `/checkin?t=${encodeURIComponent(token)}`)}`;
  const svg = await QRCode.toString(checkinUrl, {
    type: "svg",
    margin: 2,
    width: 280,
    errorCorrectionLevel: "M",
  });

  return (
    <KioskView
      gymSlug={gymSlug}
      initialQrSvg={svg}
      initialQrExpiresInMs={msUntilNextBucket()}
    />
  );
}
