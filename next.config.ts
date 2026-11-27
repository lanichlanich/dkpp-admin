import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { cpus: 1, webpackBuildWorker: true, webpackMemoryOptimizations: true },
  webpack(config, { dev }) {
    if (!dev && process.env.DKPP_LOW_MEMORY_BUILD === "1") {
      config.parallelism = 1;
      config.cache = false;
    }
    return config;
  },
  allowedDevOrigins: ["192.168.1.18"],
  serverExternalPackages: ["@napi-rs/canvas", "@tesseract.js-data/ind", "pdfjs-dist", "pdfkit", "tesseract.js"],
};

export default nextConfig;
