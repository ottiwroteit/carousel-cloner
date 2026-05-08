import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: path.dirname(new URL(import.meta.url).pathname),
  serverExternalPackages: ["openai"]
};

export default nextConfig;
