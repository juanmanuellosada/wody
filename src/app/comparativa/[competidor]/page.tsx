import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check, Minus, ExternalLink } from "lucide-react";

import wodyTexto from "@/logos/wody-texto.png";
import { SITE_URL } from "@/lib/site";
import { COMPARATIVAS, getComparativa } from "@/lib/comparativas";

interface Props {
  params: Promise<{ competidor: string }>;
}

export function generateStaticParams() {
  return COMPARATIVAS.map((c) => ({ competidor: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competidor } = await params;
  const data = getComparativa(competidor);
  if (!data) return {};

  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: `/comparativa/${data.slug}` },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/comparativa/${data.slug}`,
      title: data.title,
      description: data.description,
    },
  };
}

export default async function ComparativaPage({ params }: Props) {
  const { competidor } = await params;
  const data = getComparativa(competidor);
  if (!data) notFound();

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `¿Cuánto sale Wody comparado con ${data.competidor}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Wody cuesta $40.000 ARS por mes con 7 días de prueba gratis sin tarjeta. ${data.filas.find((f) => f.criterio.startsWith("Precio") || f.criterio.startsWith("Costo"))?.rival ?? ""}`,
        },
      },
      {
        "@type": "Question",
        name: `¿Cuándo conviene ${data.competidor} en vez de Wody?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: data.cuandoElRival.join(" "),
        },
      },
    ],
  };

  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />

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

      <section className="px-6 pt-14 pb-16 max-w-3xl mx-auto w-full">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red mb-4">
          Comparativa
        </p>
        <h1 className="text-3xl sm:text-5xl font-heading font-black uppercase tracking-[0.02em] mb-6">
          {data.h1}
        </h1>
        <p className="text-base text-gray-400 font-body leading-relaxed">
          {data.intro}
        </p>
      </section>

      {/* Tabla */}
      <section className="px-6 pb-16 max-w-3xl mx-auto w-full">
        <div className="overflow-x-auto border border-white/[0.08]">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="p-4 text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
                  Criterio
                </th>
                <th className="p-4 text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red">
                  Wody
                </th>
                <th className="p-4 text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
                  {data.competidor}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.filas.map((fila) => (
                <tr key={fila.criterio} className="border-t border-white/[0.06]">
                  <td className="p-4 text-sm text-gray-300 font-body align-top">
                    {fila.criterio}
                  </td>
                  <td className="p-4 text-sm text-white font-body align-top">
                    <span className="flex gap-2">
                      {fila.ventaja === "wody" ? (
                        <Check
                          className="w-4 h-4 text-brand-red flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <Minus
                          className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                      {fila.wody}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400 font-body align-top">
                    <span className="flex gap-2">
                      {fila.ventaja === "rival" ? (
                        <Check
                          className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <Minus
                          className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                      {fila.rival}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.fuente && data.verificadoEl ? (
          <p className="mt-4 text-xs text-gray-600 font-body">
            Datos de {data.competidor} verificados el {data.verificadoEl} en{" "}
            <a
              href={data.fuente.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-gray-400 underline underline-offset-2 hover:text-white inline-flex items-center gap-1"
            >
              {data.fuente.label}
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            . Los precios cambian: verificá antes de decidir.
          </p>
        ) : null}
      </section>

      {/* Por qué Wody */}
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-8">
            Por qué un gimnasio argentino elige Wody
          </h2>
          <ul className="flex flex-col gap-4">
            {data.porQueWody.map((punto) => (
              <li key={punto} className="flex gap-3 text-sm text-gray-300 font-body">
                <Check
                  className="w-4 h-4 text-brand-red flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                {punto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Honestidad */}
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-3">
            Cuándo te conviene {data.competidor}
          </h2>
          <p className="text-sm text-gray-500 font-body mb-8">
            No todos los gimnasios están mejor con Wody. Estos son los casos en
            los que te conviene la otra opción.
          </p>
          <ul className="flex flex-col gap-4">
            {data.cuandoElRival.map((punto) => (
              <li key={punto} className="flex gap-3 text-sm text-gray-400 font-body">
                <span className="text-gray-600 flex-shrink-0" aria-hidden="true">
                  &#8226;
                </span>
                {punto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-16">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-3">
            Probalo con tu gimnasio cargado
          </h2>
          <p className="text-sm text-gray-400 font-body mb-8">
            7 días gratis, sin tarjeta. Si no te sirve, no hiciste nada más que
            perder una tarde.
          </p>
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

      {/* Otras comparativas — enlazado interno */}
      <section className="px-6 py-14 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-5">
            Otras comparativas
          </p>
          <div className="flex flex-wrap gap-3">
            {COMPARATIVAS.filter((c) => c.slug !== data.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/comparativa/${c.slug}`}
                className="px-4 py-2 border border-white/[0.08] text-sm text-gray-300 font-body hover:bg-white/5 transition-colors"
              >
                Wody vs {c.competidor}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
