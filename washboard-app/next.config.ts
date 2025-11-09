import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  outputFileTracingRoot: __dirname, // important for Vercel + nested structure
};

export default nextConfig;
