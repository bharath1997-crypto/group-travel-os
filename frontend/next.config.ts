import type { NextConfig } from "next";
import path from "path";
import { logMapProviderBuildWarnings } from "./lib/map-providers";

logMapProviderBuildWarnings();

/** Ensure apiFetch paths resolve under /api/v1 (fixes duplicate .env.local entries). */
function normalizePublicApiUrl(raw: string | undefined): string {
  const fallback = "http://localhost:8000/api/v1";
  if (!raw?.trim()) return fallback;
  const base = raw.trim().replace(/\/+$/, "");
  if (base.endsWith("/api/v1")) return base;
  return `${base}/api/v1`;
}

const publicApiUrl = normalizePublicApiUrl(process.env.NEXT_PUBLIC_API_URL);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: publicApiUrl,
  },
  transpilePackages: ["maplibre-gl"],
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  /** Pin Turbopack to this app when multiple lockfiles exist above this folder. */
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async redirects() {
    return [
      { source: "/feed", destination: "/explore/events", permanent: false },
      { source: "/explorer", destination: "/explore", permanent: false },
      {
        source: "/explorer/:path*",
        destination: "/explore/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
