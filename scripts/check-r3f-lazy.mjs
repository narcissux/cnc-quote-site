/**
 * Guard: StlViewer / R3F must not be statically imported from QuoteApp
 * (eager import loads @react-three/fiber on page render and can throw
 * ReactCurrentOwner under Next 15). Run: node scripts/check-r3f-lazy.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const quoteApp = readFileSync(resolve("src/components/QuoteApp.tsx"), "utf8");
const staticImport = /import\s*\{[^}]*StlViewer[^}]*\}\s*from\s*["']\.\/StlViewer["']/;
const hasDynamic =
  /const\s+StlViewer\s*=\s*dynamic\s*\(/.test(quoteApp) &&
  /import\(["']\.\/StlViewer["']\)/.test(quoteApp) &&
  /ssr:\s*false/.test(quoteApp);

if (staticImport.test(quoteApp)) {
  console.error("FAIL: QuoteApp statically imports StlViewer (R3F loads eagerly).");
  process.exit(1);
}
if (!hasDynamic) {
  console.error("FAIL: QuoteApp missing next/dynamic StlViewer with ssr:false.");
  process.exit(1);
}
console.log("OK: StlViewer is lazy-loaded via next/dynamic (ssr:false).");
console.log("Manual smoke: open /, confirm page loads without ReactCurrentOwner;");
console.log("then upload an STL and confirm 3D preview mounts without that error.");
