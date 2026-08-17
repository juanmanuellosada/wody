import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import wodyTexto from "@/logos/wody-texto.png";
import { SITE_URL } from "@/lib/site";
import { COMPARATIVAS } from "@/lib/comparativas";

export const metadata: Metadata = {
  title: "Comparativas de software para gimnasios en Argentina | Wody",
  description:
    "Comparaciones honestas entre Wody y las principales plataformas de gestión de gimnasios y boxes: BoxMagic, CrossHero y Wodify. Precios, medios de pago y cuándo conviene cada una.",
  alternates: { canonical: "/comparativa" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/comparativa`,
    title: "Comparativas de software para gimnasios en Argentina | Wody",
    description:
      "Wody vs BoxMagic, CrossHero y Wodify: precios, medios de pago y en qué casos conviene cada plataforma.",
  },
};

export default function ComparativasIndex() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white">
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

      <section className="px-6 pt-14 pb-12 max-w-3xl mx-auto w-full">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red mb-4">
          Comparativas
        </p>
        <h1 className="text-3xl sm:text-5xl font-heading font-black uppercase tracking-[0.02em] mb-6">
          Wody frente a las otras opciones
        </h1>
        <p className="text-base text-gray-400 font-body leading-relaxed">
          Si estás eligiendo software para tu gimnasio o box, estas
          comparaciones te ahorran la investigación. Cada dato de la competencia
          sale de su sitio oficial, con fecha y link, y en cada página vas a
          encontrar también los casos en los que te conviene la otra opción
          antes que Wody.
        </p>
      </section>

      <section className="px-6 pb-24 max-w-3xl mx-auto w-full">
        <div className="flex flex-col">
          {COMPARATIVAS.map((c) => (
            <Link
              key={c.slug}
              href={`/comparativa/${c.slug}`}
              className="group border-t border-white/[0.08] last:border-b py-7 flex items-start justify-between gap-6 hover:bg-white/[0.02] transition-colors px-2"
            >
              <div>
                <h2 className="text-lg font-heading font-black uppercase tracking-[0.05em] mb-2">
                  Wody vs {c.competidor}
                </h2>
                <p className="text-sm text-gray-500 font-body leading-relaxed">
                  {c.description}
                </p>
              </div>
              <ArrowRight
                className="w-5 h-5 text-gray-600 flex-shrink-0 mt-1 group-hover:text-brand-red transition-colors"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
