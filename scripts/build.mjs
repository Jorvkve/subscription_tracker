// `npm run build` for every platform.
//
// Vercel and local builds run `next build`. Cloudflare Workers Builds (WORKERS_CI=1) runs the
// dashboard's build command, `npm run build`, and then `wrangler deploy`, which needs the
// `.open-next` output; so there this runs `opennextjs-cloudflare build` instead. OpenNext runs
// `next build` itself through `buildCommand` in open-next.config.ts, which avoids recursion.
import { execSync } from "node:child_process";

const cloudflare = process.env.WORKERS_CI === "1";
execSync(cloudflare ? "npx opennextjs-cloudflare build" : "npx next build", { stdio: "inherit" });
