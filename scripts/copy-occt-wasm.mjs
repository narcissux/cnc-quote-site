#!/usr/bin/env node
/**
 * Copy occt-import-js.wasm into public/ so Next.js API routes can locate it
 * without webpack rewriting require.resolve() to a module id.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "public");
const dest = join(destDir, "occt-import-js.wasm");

let src;
try {
  const require = createRequire(join(root, "package.json"));
  src = join(dirname(require.resolve("occt-import-js")), "occt-import-js.wasm");
} catch (err) {
  // occt-import-js may be unavailable (e.g. incomplete install); skip.
  console.warn(`copy-occt-wasm: skip (${err instanceof Error ? err.message : err})`);
  process.exit(0);
}

if (!existsSync(src)) {
  console.warn(`copy-occt-wasm: missing ${src}; skip`);
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`copy-occt-wasm: ${src} -> ${dest}`);
