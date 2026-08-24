import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // Los artículos del blog son .mdx; el resto de las extensiones son las de siempre.
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  async headers() {
    return [
      {
        // Vercel publica el proyecto también en *.vercel.app, sin noindex y
        // con 200. Google la rastreó antes que el dominio propio y la eligió
        // como canónica, dejando wody.com.ar fuera del índice por "duplicada".
        // El noindex saca del índice a la URL de Vercel; el canonical de las
        // páginas se encarga de consolidar todo en www.wody.com.ar.
        source: "/:path*",
        has: [{ type: "host", value: ".*\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:gymSlug/pagos",
        destination: "/:gymSlug/cuotas",
        permanent: false,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4.5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        // Vercel Blob public URLs
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

// remark-gfm habilita las tablas de markdown, que MDX no trae de fábrica.
// Con Turbopack el plugin va por nombre: no se pueden pasar funciones de JS
// al bundler, que corre en Rust.
const withMDX = createMDX({
  options: { remarkPlugins: ["remark-gfm"] },
});

export default withMDX(nextConfig);
