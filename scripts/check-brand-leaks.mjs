#!/usr/bin/env node
/**
 * CI guard: block client-specific brand names in source code.
 * Add banned terms to scripts/banned-brands.txt (one per line, lowercase).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".")), "..");

const SCAN_DIRS = ["apps", "packages", "config/prompts", "db/migrations", "scripts"];
const SKIP_FILES = new Set([
  "check-brand-leaks.mjs",
  "banned-brands.txt",
]);
const SKIP_EXT = new Set([".png", ".jpg", ".ico", ".lock"]);

const bannedPath = join(ROOT, "scripts", "banned-brands.txt");
const bannedRaw = readFileSync(bannedPath, "utf-8");
const banned = bannedRaw
  .split("\n")
  .map((l) => l.trim().toLowerCase())
  .filter((l) => l && !l.startsWith("#"));

if (banned.length === 0) {
  console.warn("warning: no banned brands configured");
}

const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (rel.includes("node_modules") || rel.includes("dist")) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    const ext = name.slice(name.lastIndexOf("."));
    if (SKIP_EXT.has(ext) || SKIP_FILES.has(name)) continue;
  scanFile(full, rel);
  }
}

function scanFile(fullPath, relPath) {
  const content = readFileSync(fullPath, "utf-8").toLowerCase();
  for (const term of banned) {
    if (content.includes(term)) {
      violations.push({ file: relPath, term });
    }
  }
}

for (const dir of SCAN_DIRS) {
  walk(join(ROOT, dir));
}

if (violations.length > 0) {
  console.error("Brand leak check FAILED. Client names must not appear in source.\n");
  console.error("Use environment variables (BRAND_NAME, etc.) — see docs/white-label.md\n");
  for (const v of violations) {
    console.error(`  - "${v.term}" in ${v.file}`);
  }
  process.exit(1);
}

console.log(`Brand leak check passed (${banned.length} banned terms).`);
