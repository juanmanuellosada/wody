import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { COMPARATIVAS } from "@/lib/comparativas";
import { ARTICULOS } from "@/lib/blog";
import { PAGINAS_PUBLICAS } from "@/lib/rutas-publicas";

// El listado de gyms sale de la DB, así que cada gym nuevo entra solo al
// sitemap. Una hora de cache sobra: no damos de alta gyms a ese ritmo.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // `kind` no es nullable, así que el `not` acá es seguro. Excluimos PERSONAL
  // por el mismo motivo que la landing: no es un centro que un visitante elija.
  const gyms = await prisma.gym.findMany({
    where: { blockedAt: null, kind: { not: "PERSONAL" } },
    orderBy: { createdAt: "asc" },
    select: { slug: true, createdAt: true },
  });

  return [
    ...PAGINAS_PUBLICAS.map((route) => ({
      url: `${SITE_URL}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    // Comparativas: son las páginas que apuntan a búsquedas de intención de
    // compra ("boxmagic precio"), así que van con prioridad alta.
    ...COMPARATIVAS.map((c) => ({
      url: `${SITE_URL}/comparativa/${c.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...ARTICULOS.map((a) => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: new Date(a.fecha),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // La landing pública de cada gym es la entrada de SEO local
    // ("gimnasio en Los Polvorines") y hasta ahora no estaba enlazada.
    ...gyms.map((gym) => ({
      url: `${SITE_URL}/${gym.slug}`,
      lastModified: gym.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
