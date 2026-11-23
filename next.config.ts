import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { cpus: 1, webpackMemoryOptimizations: true },
  allowedDevOrigins: ["192.168.1.18"],
  serverExternalPackages: ["@napi-rs/canvas", "@tesseract.js-data/ind", "pdfjs-dist", "pdfkit", "tesseract.js"],
};

export default nextConfig;
