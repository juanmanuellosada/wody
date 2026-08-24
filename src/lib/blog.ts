/**
 * Índice de artículos del blog.
 *
 * La metadata vive acá y el cuerpo en `src/content/blog/{slug}.mdx`. Se separan
 * a propósito: el sitemap, el listado y las etiquetas <meta> necesitan estos
 * datos tipados, y el .mdx queda como markdown limpio para escribir cómodo.
 *
 * Para publicar un artículo nuevo: creá el .mdx y agregá su entrada acá. Si no
 * está en esta lista, no existe para el sitio.
 */

export type Articulo = {
  slug: string;
  titulo: string;
  /** <title> de la página. Arranca por la búsqueda, no por la marca. */
  title: string;
  descripcion: string;
  /** ISO, para <time> y para el sitemap. */
  fecha: string;
  /** Minutos de lectura, redondeado. */
  lectura: number;
};

export const ARTICULOS: Articulo[] = [
  {
    slug: "cuanto-cuesta-mandar-rutinas-por-whatsapp",
    titulo: "Cuánto te cuesta realmente mandar las rutinas por WhatsApp",
    title: "Cuánto cuesta mandar las rutinas del gimnasio por WhatsApp | Wody",
    descripcion:
      "El tiempo que tu profe pasa contestando mensajes tiene un costo concreto. Cómo calcularlo para tu gimnasio y qué se puede hacer al respecto.",
    fecha: "2026-08-24",
    lectura: 5,
  },
  {
    slug: "metricas-dueno-gimnasio",
    titulo: "3 métricas que todo dueño de gimnasio debería mirar cada mes",
    title: "3 métricas que todo dueño de gimnasio debería mirar cada mes | Wody",
    descripcion:
      "Retención, asistencia y morosidad: qué son, cómo se calculan con lo que ya tenés anotado, y qué número debería preocuparte.",
    fecha: "2026-08-24",
    lectura: 6,
  },
  {
    slug: "por-que-se-van-los-alumnos-mes-2-y-3",
    titulo: "Por qué se te van los alumnos entre el mes 2 y el 3",
    title: "Por qué se van los alumnos del gimnasio en el mes 2 y 3 | Wody",
    descripcion:
      "La deserción no es aleatoria: se concentra en una ventana concreta y por motivos identificables. Qué pasa en esos meses y cómo intervenir a tiempo.",
    fecha: "2026-08-24",
    lectura: 6,
  },
];

export function getArticulo(slug: string): Articulo | undefined {
  return ARTICULOS.find((a) => a.slug === slug);
}

/** Más nuevos primero. */
export function articulosOrdenados(): Articulo[] {
  return [...ARTICULOS].sort((a, b) => b.fecha.localeCompare(a.fecha));
}
