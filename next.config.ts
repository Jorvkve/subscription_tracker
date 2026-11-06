import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // 4 MiB file + multipart overhead, staying under Vercel's 4.5 MB request limit
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;
