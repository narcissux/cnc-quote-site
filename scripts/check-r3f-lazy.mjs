/**
 * Guard: StlViewer must not import @react-three/fiber or @react-three/drei.
 * QuoteApp should lazy-load StlViewer with ssr:false.
 * Run: node scripts/check-r3f-lazy.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const viewer = readFileSync(resolve("src/components/StlViewer.tsx"), "utf8");
const quoteApp = readFileSync(resolve("src/components/QuoteApp.tsx"), "utf8");

const fiberImport =
  /(?:from|import)\s*["']@react-three\/(?:fiber|drei)["']/;
if (fiberImport.test(viewer)) {
  console.error("FAIL: StlViewer imports @react-three/fiber or drei — use native three.js only.");
  process.exit(1);
}
if (!/from\s+["']three["']/.test(viewer) || !/OrbitControls/.test(viewer)) {
  console.error("FAIL: StlViewer should use three + OrbitControls.");
  process.exit(1);
}
if (/Canvas/.test(viewer) && /@react-three/.test(viewer)) {
  console.error("FAIL: StlViewer still references R3F Canvas.");
  process.exit(1);
}

const staticImport = /import\s*\{[^}]*StlViewer[^}]*\}\s*from\s*["']\.\/StlViewer["']/;
const hasDynamic =
  /const\s+StlViewer\s*=\s*dynamic\s*\(/.test(quoteApp) &&
  /import\(["']\.\/StlViewer["']\)/.test(quoteApp) &&
  /ssr:\s*false/.test(quoteApp);

if (staticImport.test(quoteApp)) {
  console.error("FAIL: QuoteApp statically imports StlViewer.");
  process.exit(1);
}
if (!hasDynamic) {
  console.error("FAIL: QuoteApp missing next/dynamic StlViewer with ssr:false.");
  process.exit(1);
}

console.log("OK: StlViewer uses native three.js (no fiber/drei); lazy-loaded with ssr:false.");
