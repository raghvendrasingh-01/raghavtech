import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the workspace root — the repo has multiple lockfiles (monorepo),
  // so Next would otherwise guess the parent directory.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
