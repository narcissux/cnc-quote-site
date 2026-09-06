import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three ships as ESM; transpile for Next bundler
  transpilePackages: ["three"],
};

export default nextConfig;
