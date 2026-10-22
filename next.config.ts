import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the repo free of generated agent instruction files.
  agentRules: false,
  // The floating dev-tools button sits on top of the mobile tab bar.
  devIndicators: false,
  /* config options here */
};

export default nextConfig;
