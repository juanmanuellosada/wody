import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, AlertTriangle, Clock3 } from "lucide-react";
import { getRedemptionByCode } from "@/actions/coupon";
import { getCouponLogo } from "@/lib/coupon-logos";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import wodyTexto from "@/logos/wody-texto.png";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Validar cupón — WODY",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ codigo: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function ValidarPage({ params }: PageProps) {
  const { codigo } = await params;
  const result = await getRedemptionByCode(codigo);

  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white px-6 py-10">
      <Link href="/" className="mx-auto mb-8">
        <Image
          src={wodyTexto}
          alt="WODY"
          width={96}
          height={26}
          className="w-24 h-auto opacity-60 hover:opacity-100 transition-opacity"
          priority
        />
      </Link>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-lg">
          {!result.found ? (
            <NotFoundCard code={codigo} />
          ) : (
            <ResultCard result={result} />
          )}
        </div>
      </div>

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-gray-700 font-body tracking-wide">
          Validación de beneficios · WODY
        </p>
      </footer>
    </main>
  );
}

function NotFoundCard({ code }: { code: string }) {
  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-8 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-red/10 border border-brand-red/30 mb-6">
        <AlertTriangle size={28} className="text-brand-red" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-heading font-black uppercase tracking-[0.1em] text-white mb-2">
        Código inválido
      </h1>
      <p className="text-sm text-gray-500 font-body mb-4">
        No encontramos ningún cupón con el código
      </p>
      <p className="font-heading font-black tracking-[0.2em] text-brand-red mb-6 break-all">
        {code.toUpperCase()}
      </p>
      <p className="text-xs text-gray-600 font-body leading-relaxed">
        Pedile al alumno que revise el código en su app y te lo pase de nuevo.
      </p>
    </div>
  );
}

function ResultCard({
  result,
}: {
  result: Extract<Awaited<ReturnType<typeof getRedemptionByCode>>, { found: true }>;
}) {
  const logo = getCouponLogo(result.coupon.logoKey);
  const consumed = result.status === "CONSUMED";
  const justConsumed = result.wasJustConsumed;

  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] overflow-hidden">
      <div
        className={[
          "px-6 py-5 flex items-center gap-3 border-b",
          justConsumed
            ? "bg-brand-red/10 border-brand-red/30"
            : consumed
            ? "bg-[#141414] border-white/[0.06]"
            : "bg-[#141414] border-white/[0.06]",
        ].join(" ")}
      >
        {justConsumed ? (
          <>
            <CheckCircle2 size={24} className="text-brand-red flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-heading font-black uppercase tracking-[0.15em] text-white">
                Cupón válido
              </p>
              <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-brand-red/80">
                Recién canjeado · No se puede usar de nuevo
              </p>
            </div>
          </>
        ) : (
          <>
            <Clock3 size={24} className="text-gray-500 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-heading font-black uppercase tracking-[0.15em] text-white">
                Ya fue usado
              </p>
              {result.consumedAt && (
                <p className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
                  El {DATE_FORMAT.format(result.consumedAt)}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="p-6 flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 flex-shrink-0 bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden">
            {logo ? (
              <Image
                src={logo}
                alt={result.coupon.name}
                width={80}
                height={80}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <span className="text-2xl font-heading font-black uppercase text-brand-red">
                {result.coupon.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-heading font-black uppercase tracking-[0.05em] text-white truncate">
              {result.coupon.name}
            </h1>
            <a
              href={result.coupon.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-red font-body transition-colors mt-1"
            >
              <InstagramIcon size={12} />
              @{result.coupon.instagramHandle}
            </a>
          </div>
        </div>

        <p className="text-xs text-gray-400 font-body leading-relaxed border-t border-white/[0.05] pt-4">
          {result.coupon.description}
        </p>

        <dl className="flex flex-col gap-2 border-t border-white/[0.05] pt-4 text-xs">
          <InfoRow label="Código" value={result.code} mono />
          <InfoRow label="Alumno" value={result.user.name} />
          <InfoRow label="Gym" value={result.user.gymName} />
          <InfoRow
            label="Generado"
            value={DATE_FORMAT.format(result.createdAt)}
          />
          {result.consumedAt && (
            <InfoRow
              label="Validado"
              value={DATE_FORMAT.format(result.consumedAt)}
            />
          )}
        </dl>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-[10px] font-heading font-bold uppercase tracking-[0.15em] text-gray-600 w-20 flex-shrink-0">
        {label}
      </dt>
      <dd
        className={[
          "text-gray-200 font-body break-all",
          mono ? "font-heading font-black tracking-[0.15em] text-brand-red" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
