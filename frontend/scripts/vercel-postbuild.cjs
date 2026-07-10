/**
 * Vercel post-build: copy routes-manifest.json → routes-manifest-deterministic.json
 * when the deterministic variant is missing (Next.js 16 + Turbopack local builds
 * only emit routes-manifest.json; Vercel finalization may expect the deterministic name).
 */
const fs = require("fs");
const path = require("path");

const nextDir = path.join(__dirname, "..", ".next");
const routesManifest = path.join(nextDir, "routes-manifest.json");
const deterministic = path.join(nextDir, "routes-manifest-deterministic.json");

if (!fs.existsSync(routesManifest)) {
  console.warn("[vercel-postbuild] routes-manifest.json not found — skipping");
  process.exit(0);
}

if (!fs.existsSync(deterministic)) {
  fs.copyFileSync(routesManifest, deterministic);
  console.log("[vercel-postbuild] Created routes-manifest-deterministic.json");
}
