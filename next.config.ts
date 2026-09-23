import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.18"],
  serverExternalPackages: ["@napi-rs/canvas", "@tesseract.js-data/ind", "pdfjs-dist", "tesseract.js"],
};

export default nextConfig;
