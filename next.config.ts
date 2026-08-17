import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
