import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  // Dev only: lets phones on the local network load the dev server (e.g. testing /join on a real iPhone)
  allowedDevOrigins: ['10.*.*.*', '192.168.*.*', '172.16.*.*'],
};

export default nextConfig;
