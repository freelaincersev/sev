import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — a parent-level pnpm-lock.yaml would otherwise
  // make Next infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
