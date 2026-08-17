import Link from "next/link";
import Image from "next/image";
import wodyTexto from "@/logos/wody-texto.png";

/** Encabezado con el logo, compartido por las páginas públicas de marketing. */
export function MarketingHeader() {
  return (
    <header className="px-6 pt-10">
      <Link href="/" className="inline-block">
        <Image
          src={wodyTexto}
          alt="Wody"
          width={160}
          height={46}
          className="w-28 h-auto"
          unoptimized
        />
      </Link>
    </header>
  );
}

/** Cierre con llamada a la acción. El texto varía por página. */
export function MarketingCta({
  titulo,
  bajada,
}: {
  titulo: string;
  bajada: string;
}) {
  return (
    <section className="border-t border-white/5 bg-[#08080D] px-6 py-16">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-3">
          {titulo}
        </h2>
        <p className="text-sm text-gray-400 font-body mb-8">{bajada}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/demo"
            className="px-8 py-3 bg-brand-red text-white text-sm font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-hover transition-colors"
          >
            Ver la demo
          </Link>
          <Link
            href="/"
            className="px-8 py-3 border border-white/20 text-white text-sm font-heading font-bold uppercase tracking-[0.15em] hover:bg-white/5 transition-colors"
          >
            Precios y funciones
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Bloque de preguntas frecuentes. El JSON-LD lo arma cada página. */
export function MarketingFaq({
  preguntas,
}: {
  preguntas: Array<{ q: string; a: string }>;
}) {
  return (
    <section className="px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-10">
          Preguntas frecuentes
        </h2>
        <dl className="flex flex-col">
          {preguntas.map((p) => (
            <div
              key={p.q}
              className="border-t border-white/[0.08] last:border-b py-6"
            >
              <dt className="text-base font-heading font-bold text-white mb-2">
                {p.q}
              </dt>
              <dd className="text-sm text-gray-400 font-body leading-relaxed">
                {p.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function faqJsonLd(preguntas: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: preguntas.map((p) => ({
      "@type": "Question",
      name: p.q,
      acceptedAnswer: { "@type": "Answer", text: p.a },
    })),
  };
}
