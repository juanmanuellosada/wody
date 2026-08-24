import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { SITE_URL } from "@/lib/site";
import { articulosOrdenados } from "@/lib/blog";
import { MarketingHeader } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Blog para dueños de gimnasios y boxes | Wody",
  description:
    "Gestión, retención y números de un gimnasio o box, explicados sin vueltas. Escrito para el que lo administra todos los días.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/blog`,
    title: "Blog para dueños de gimnasios y boxes | Wody",
    description:
      "Gestión, retención y números de un gimnasio o box, explicados sin vueltas.",
  },
};

export default function BlogIndex() {
  const articulos = articulosOrdenados();

  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white">
      <MarketingHeader />

      <section className="px-6 pt-14 pb-12 max-w-2xl mx-auto w-full">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red mb-4">
          Blog
        </p>
        <h1 className="text-3xl sm:text-5xl font-heading font-black uppercase tracking-[0.02em] mb-6">
          Para el que maneja el gimnasio
        </h1>
        <p className="text-base text-gray-400 font-body leading-relaxed">
          Gestión, retención y números, sin vueltas y sin recetas mágicas.
          Escrito para dueños y profes de gimnasios y boxes, no para consultores.
        </p>
      </section>

      <section className="px-6 pb-24 max-w-2xl mx-auto w-full">
        <div className="flex flex-col">
          {articulos.map((a) => (
            <Link
              key={a.slug}
              href={`/blog/${a.slug}`}
              className="group border-t border-white/[0.08] last:border-b py-7 flex items-start justify-between gap-6 hover:bg-white/[0.02] transition-colors px-2"
            >
              <div>
                <h2 className="text-lg font-heading font-black uppercase tracking-[0.04em] mb-2 leading-snug">
                  {a.titulo}
                </h2>
                <p className="text-sm text-gray-500 font-body leading-relaxed mb-2">
                  {a.descripcion}
                </p>
                <span className="text-xs text-gray-600 font-body">
                  {a.lectura} min de lectura
                </span>
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
