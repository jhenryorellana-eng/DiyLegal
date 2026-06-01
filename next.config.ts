import type { NextConfig } from "next";

/**
 * Configuración de Next.js (doc 06 §3).
 * - `serverExternalPackages`: pdf-parse / pdfjs-dist no deben pasar por el bundler del servidor.
 *   Se usan a partir de la Fase 1 (Fee Schedule G-1055) y Fase 2 (generación de PDF).
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  reactStrictMode: true,
};

export default nextConfig;
