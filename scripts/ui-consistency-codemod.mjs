#!/usr/bin/env node
/**
 * Rovvy UI consistency codemod — replaces legacy decorative colors with semantic brand tokens.
 * Run: node scripts/ui-consistency-codemod.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("frontend");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "__tests__"]);
const EXT = new Set([".tsx", ".ts", ".css"]);

/** Decorative legacy colors → Tailwind semantic utilities or brand hex */
const REPLACEMENTS = [
  // Old navy palette → brand navy
  [/\#0[Ff]3460/g, "#0F172A"],
  [/\#16213[Ee]/g, "#1E293B"],
  [/\#1[Ee]4976/g, "#1E293B"],
  [/\#1[Ee]2[Aa]3[Aa]/g, "#1E293B"],
  [/\#162[Dd]4[Aa]/g, "#1E293B"],
  [/\#1[Aa]3554/g, "#1E293B"],
  // Inconsistent teal variants → primary
  [/\#007[Ff]73/g, "#0F766E"],
  [/\#E6F7F4/g, "#CCFBF1"],
  // Decorative coral → primary (buttons, tabs, accents — not map POI semantics)
  [/\bborder-\[\#E94560\]/g, "border-primary"],
  [/\bborder-\[\#e94560\]/g, "border-primary"],
  [/\bbg-\[\#E94560\]/g, "bg-primary"],
  [/\bbg-\[\#e94560\]/g, "bg-primary"],
  [/\btext-\[\#E94560\]/g, "text-primary"],
  [/\btext-\[\#e94560\]/g, "text-primary"],
  [/\bborder-t-\[\#E94560\]/g, "border-t-primary"],
  [/\bborder-t-\[\#e94560\]/g, "border-t-primary"],
  [/\bfocus:border-\[\#E94560\]/g, "focus:border-primary"],
  [/\bfocus:ring-\[\#E94560\]/g, "focus:ring-primary"],
  [/\bhover:bg-\[\#E94560\]/g, "hover:bg-primary"],
  [/\bhover:bg-\[\#ff5670\]/g, "hover:bg-primary-hover"],
  [/\bhover:bg-\[\#c73652\]/g, "hover:bg-primary-hover"],
  [/\bhover:text-\[\#E94560\]/g, "hover:text-primary"],
  [/\bhover:border-\[\#E94560\]/g, "hover:border-primary"],
  [/\bring-\[\#E94560\]/g, "ring-primary"],
  [/\bfrom-\[\#E94560\]/g, "from-primary"],
  [/\bto-\[\#E94560\]/g, "to-primary"],
  [/\bvia-\[\#E94560\]/g, "via-primary"],
  // Primary brand hex → token classes where common
  [/\bbg-\[\#0[Ff]766[Ee]\]/g, "bg-primary"],
  [/\btext-\[\#0[Ff]766[Ee]\]/g, "text-primary"],
  [/\bborder-\[\#0[Ff]766[Ee]\]/g, "border-primary"],
  [/\bhover:bg-\[\#0[Dd]635[Cc]\]/g, "hover:bg-primary-hover"],
  [/\bhover:text-\[\#0[Dd]635[Cc]\]/g, "hover:text-primary-hover"],
  [/\bfocus-within:border-\[\#0[Ff]766[Ee]\]/g, "focus-within:border-primary"],
  [/\bfocus-within:ring-\[\#0[Ff]766[Ee]\]\/15/g, "focus-within:ring-primary/15"],
  [/\bfocus-visible:outline-\[\#0[Ff]766[Ee]\]/g, "focus-visible:outline-primary"],
  [/\bbg-\[\#0[Ff]172[Aa]\]/g, "bg-navy"],
  [/\btext-\[\#0[Ff]172[Aa]\]/g, "text-navy"],
  [/\bbg-\[\#F8FAFC\]/g, "bg-app"],
  [/\btext-\[\#94A3B8\]/g, "text-muted"],
  [/\bbg-\[\#CCFBF1\]/g, "bg-primary-soft"],
  [/\btext-\[\#CCFBF1\]/g, "text-primary-soft"],
];

/** String/const legacy colors in JS */
const JS_REPLACEMENTS = [
  [/const CORAL = "#E94560";/g, 'const CORAL = "#0F766E";'],
  [/const CORAL = "#e94560";/g, 'const CORAL = "#0F766E";'],
  [/const NAV_BG = "#0F172A";/g, ""],
  [/const MUTED = "#94A3B8";/g, ""],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXT.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (file.includes("live-design-tokens") || file.includes("live-map-")) continue;
  if (file.includes("design-tokens.ts") || file.includes("globals.css")) continue;

  let src = fs.readFileSync(file, "utf8");
  const original = src;

  for (const [pattern, replacement] of REPLACEMENTS) {
    src = src.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of JS_REPLACEMENTS) {
    src = src.replace(pattern, replacement);
  }

  if (src !== original) {
    fs.writeFileSync(file, src);
    changed++;
    console.log("updated:", path.relative(process.cwd(), file));
  }
}

console.log(`\nDone. ${changed} files updated.`);
