import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.dirname(new URL(import.meta.url).pathname),
  serverExternalPackages: ["openai"]
};

export default nextConfig;
