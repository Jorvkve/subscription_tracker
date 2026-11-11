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
    // Keep a visited page in the browser's router cache for 30 seconds, so switching back and
    // forth between tabs is instant. Server actions still refresh the pages they change.
    staleTimes: {
      dynamic: 30,
    },
    serverActions: {
      // 4 MiB file + multipart overhead, staying under Vercel's 4.5 MB request limit
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;
