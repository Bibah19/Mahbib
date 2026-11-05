import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The invitation card reads its fonts from disk at runtime; make sure they
  // are bundled into the serverless functions that render it.
  outputFileTracingIncludes: {
    "/api/invite-card/[code]": ["./assets/fonts/**/*"],
    "/api/reservations": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
