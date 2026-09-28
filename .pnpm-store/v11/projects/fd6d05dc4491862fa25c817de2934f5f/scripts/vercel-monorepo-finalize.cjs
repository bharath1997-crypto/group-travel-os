/**
 * Vercel-only monorepo finalization (see frontend/vercel.json buildCommand).
 *
 * Remove this script when Vercel fixes Git Integration finalization for
 * Root Directory subprojects with Next.js 16+.
 * Track: https://github.com/vercel/vercel/issues/15937
 */
const fs = require("fs");
const path = require("path");

const frontendDir = path.join(__dirname, "..");
const repoRoot = path.join(frontendDir, "..");
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

function linkDirToRepoRoot(name) {
  const src = path.join(frontendDir, name);
  const dest = path.join(repoRoot, name);
  if (!fs.existsSync(src)) {
    console.warn(`[vercel-finalize] ${name} not found — skipping`);
    return;
  }
  removeIfExists(dest);
  fs.symlinkSync(path.relative(repoRoot, src), dest, dirSymlinkType);
  console.log(`[vercel-finalize] Linked ${name} → repo root`);
}

function ensureEnvProductionAtRepoRoot() {
  const dest = path.join(repoRoot, ".env.production");
  if (fs.existsSync(dest)) return;

  const frontendEnv = path.join(frontendDir, ".env.production");
  if (fs.existsSync(frontendEnv)) {
    fs.copyFileSync(frontendEnv, dest);
    console.log("[vercel-finalize] Copied .env.production to repo root");
    return;
  }

  fs.writeFileSync(dest, "# Vercel monorepo finalization placeholder\n", "utf8");
  console.log("[vercel-finalize] Created placeholder .env.production at repo root");
}

linkDirToRepoRoot(".next");
linkDirToRepoRoot("node_modules");
ensureEnvProductionAtRepoRoot();
