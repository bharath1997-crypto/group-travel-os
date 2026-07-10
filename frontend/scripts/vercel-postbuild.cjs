/**
 * Vercel post-build workaround for Next.js 16 monorepo deployments.
 *
 * 1. Copy routes-manifest.json → routes-manifest-deterministic.json when missing.
 * 2. Mirror frontend/.next → repo-root/.next so Git Integration finalization finds
 *    artifacts at /vercel/path0/.next (Vercel bug when Root Directory = frontend).
 */
const fs = require("fs");
const path = require("path");

const frontendDir = path.join(__dirname, "..");
const nextDir = path.join(frontendDir, ".next");
const repoRootNext = path.join(frontendDir, "..", ".next");
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

if (!fs.existsSync(nextDir)) {
  console.warn("[vercel-postbuild] .next directory missing — skipping root mirror");
  process.exit(0);
}

fs.cpSync(nextDir, repoRootNext, { recursive: true, force: true });
console.log("[vercel-postbuild] Mirrored .next to repo root for Vercel finalization");
