import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SITE_URL, SITE_NAME } from "@/lib/site";
import { ARTICULOS, getArticulo, articulosOrdenados } from "@/lib/blog";
import {
  MarketingHeader,
  MarketingCta,
} from "@/components/marketing/MarketingShell";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return ARTICULOS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const articulo = getArticulo(slug);
  if (!articulo) return {};

  return {
    title: articulo.title,
    description: articulo.descripcion,
    alternates: { canonical: `/blog/${articulo.slug}` },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/blog/${articulo.slug}`,
      title: articulo.title,
      description: articulo.descripcion,
      publishedTime: articulo.fecha,
    },
  };
}

function fechaLegible(iso: string) {
  // Fecha fija del artículo: la parseamos como UTC y la formateamos a mano para
  // no depender del huso del servidor ni correr un día hacia atrás.
  const [anio, mes, dia] = iso.split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${dia} de ${meses[mes - 1]} de ${anio}`;
}

export default async function ArticuloPage({ params }: Props) {
  const { slug } = await params;
  const articulo = getArticulo(slug);
  if (!articulo) notFound();

  // El cuerpo vive en el .mdx; la metadata en src/lib/blog.ts.
  const { default: Cuerpo } = await import(`@/content/blog/${slug}.mdx`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: articulo.titulo,
    description: articulo.descripcion,
    datePublished: articulo.fecha,
    dateModified: articulo.fecha,
    inLanguage: "es-AR",
    mainEntityOfPage: `${SITE_URL}/blog/${articulo.slug}`,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };

  const otros = articulosOrdenados()
    .filter((a) => a.slug !== articulo.slug)
    .slice(0, 2);

  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHeader />

      <article className="px-6 pt-12 pb-16 max-w-2xl mx-auto w-full">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-500 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Blog
        </Link>

        <h1 className="text-3xl sm:text-[2.6rem] font-heading font-black uppercase tracking-[0.01em] leading-[1.08] mb-5">
          {articulo.titulo}
        </h1>

        <div className="flex items-center gap-2 text-xs text-gray-600 font-body mb-12">
          <time dateTime={articulo.fecha}>{fechaLegible(articulo.fecha)}</time>
          <span aria-hidden="true">·</span>
          <span>{articulo.lectura} min de lectura</span>
        </div>

        <Cuerpo />
      </article>

      {otros.length > 0 ? (
        <section className="px-6 pb-16 max-w-2xl mx-auto w-full">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-600 mb-5">
            Seguí leyendo
          </p>
          <div className="flex flex-col">
            {otros.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="border-t border-white/[0.08] last:border-b py-5 group"
              >
                <h2 className="text-base font-heading font-bold text-gray-300 group-hover:text-white transition-colors">
                  {a.titulo}
                </h2>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <MarketingCta
        titulo="Probá Wody en tu gimnasio"
        bajada="Rutinas, récords, turnos, control de ingresos y cuotas en una sola app. 7 días gratis, sin tarjeta."
      />
    </main>
  );
}
