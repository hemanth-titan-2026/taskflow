import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://app:3000/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://app:3000/health',
      },
    ];
  },
};

export default nextConfig;
