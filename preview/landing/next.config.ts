import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
