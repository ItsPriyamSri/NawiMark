import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md is our own hand-authored project-instructions file; don't
  // let Next.js append its generated agent-rules block to it.
  agentRules: false,
};

export default nextConfig;
