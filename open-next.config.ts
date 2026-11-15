// OpenNext config for the Cloudflare Workers build (`opennextjs-cloudflare build`).
// Every page is dynamic and signed in, so no incremental cache bucket is needed.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig({}),
  // `npm run build` starts this OpenNext build on Cloudflare (scripts/build.mjs), so OpenNext
  // must call `next build` directly instead of `npm run build`.
  buildCommand: "npx next build",
};

export default config;
