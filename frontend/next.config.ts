import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /** Pin Turbopack to this app when multiple lockfiles exist above this folder. */
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [{ source: "/feed", destination: "/explorer", permanent: false }];
  },
};

export default nextConfig;
