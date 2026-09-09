import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // three ships as ESM; transpile for Next bundler
  transpilePackages: ["three"],
  // Keep OCCT WASM loader external so locateFile resolves next to the .wasm
  serverExternalPackages: ["occt-import-js"],
  outputFileTracingIncludes: {
    "/api/parse-step": [
      "./node_modules/occt-import-js/**/*",
      "./public/occt-import-js.wasm",
    ],
  },
};

export default nextConfig;
