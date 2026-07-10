/**
 * Vercel post-build workaround for Next.js 16 monorepo deployments.
 *
 * Git Integration finalization looks under /vercel/path0/ (repo root) for
 * .next/ and node_modules/next/ even when Root Directory = frontend/.
 * Symlink those paths from frontend/ so finalization succeeds.
 */
const fs = require("fs");
const path = require("path");

const frontendDir = path.join(__dirname, "..");
const repoRoot = path.join(frontendDir, "..");
const nextDir = path.join(frontendDir, ".next");
const routesManifest = path.join(nextDir, "routes-manifest.json");
const deterministic = path.join(nextDir, "routes-manifest-deterministic.json");
const symlinkType = process.platform === "win32" ? "junction" : "dir";

function symlinkDirToRepoRoot(name) {
  const src = path.join(frontendDir, name);
  const dest = path.join(repoRoot, name);

  if (!fs.existsSync(src)) {
    console.warn(`[vercel-postbuild] ${name} not found — skipping`);
    return;
  }

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  const rel = path.relative(repoRoot, src);
  fs.symlinkSync(rel, dest, symlinkType);
  console.log(`[vercel-postbuild] Linked ${name} → repo root (${rel})`);
}

if (fs.existsSync(routesManifest) && !fs.existsSync(deterministic)) {
  fs.copyFileSync(routesManifest, deterministic);
  console.log("[vercel-postbuild] Created routes-manifest-deterministic.json");
}

symlinkDirToRepoRoot(".next");
symlinkDirToRepoRoot("node_modules");
