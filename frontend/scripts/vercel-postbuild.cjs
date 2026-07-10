/**
 * Vercel post-build workaround for Next.js 16 monorepo deployments.
 *
 * Git Integration finalization looks under /vercel/path0/ (repo root) for
 * frontend build artifacts even when Root Directory = frontend/.
 * Symlink required paths from frontend/ so finalization succeeds.
 */
const fs = require("fs");
const path = require("path");

const frontendDir = path.join(__dirname, "..");
const repoRoot = path.join(frontendDir, "..");
const nextDir = path.join(frontendDir, ".next");
const routesManifest = path.join(nextDir, "routes-manifest.json");
const deterministic = path.join(nextDir, "routes-manifest-deterministic.json");
const dirSymlinkType = process.platform === "win32" ? "junction" : "dir";

function removeIfExists(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isDirectory()) {
    fs.rmSync(target, { recursive: true, force: true });
  } else {
    fs.rmSync(target, { force: true });
  }
}

function linkToRepoRoot(name, { directory = false } = {}) {
  const src = path.join(frontendDir, name);
  const dest = path.join(repoRoot, name);

  if (!fs.existsSync(src)) {
    console.warn(`[vercel-postbuild] ${name} not found — skipping`);
    return;
  }

  removeIfExists(dest);

  const rel = path.relative(repoRoot, src);
  fs.symlinkSync(rel, dest, directory ? dirSymlinkType : "file");
  console.log(`[vercel-postbuild] Linked ${name} → repo root (${rel})`);
}

if (fs.existsSync(routesManifest) && !fs.existsSync(deterministic)) {
  fs.copyFileSync(routesManifest, deterministic);
  console.log("[vercel-postbuild] Created routes-manifest-deterministic.json");
}

linkToRepoRoot(".next", { directory: true });
linkToRepoRoot("node_modules", { directory: true });

for (const entry of fs.readdirSync(frontendDir)) {
  if (entry.startsWith(".env")) {
    linkToRepoRoot(entry);
  }
}
