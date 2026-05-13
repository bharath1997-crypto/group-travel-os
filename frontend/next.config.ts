import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
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
