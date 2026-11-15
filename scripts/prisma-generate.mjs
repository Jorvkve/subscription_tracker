// Generates the Prisma client for the platform being built.
//
// Vercel and local development use the default Node.js client. Cloudflare Workers forbid
// compiling WebAssembly at runtime, so a Cloudflare build needs the client generated with
// `runtime = "cloudflare"`, which imports the query compiler as a prebuilt .wasm module.
// Prisma does not accept env() for `runtime`, so this writes a temporary copy of the schema
// with that line added and generates from it into the same output folder.
//
// Cloudflare Workers Builds sets WORKERS_CI=1. PRISMA_RUNTIME=cloudflare forces it locally.
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const cloudflare = process.env.WORKERS_CI === "1" || process.env.PRISMA_RUNTIME === "cloudflare";

if (!cloudflare) {
  execSync("npx prisma generate", { stdio: "inherit" });
} else {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const patched = schema.replace(/(generator client \{[^}]*?)(\n\})/, '$1\n  runtime  = "cloudflare"$2');
  if (patched === schema) throw new Error("Could not find the `generator client` block in prisma/schema.prisma.");
  // Kept next to the real schema so the relative `output` path resolves the same way.
  const temp = "prisma/schema.cloudflare.prisma";
  writeFileSync(temp, patched);
  try {
    console.log("Generating the Prisma client for Cloudflare Workers");
    execSync(`npx prisma generate --schema ${temp}`, { stdio: "inherit" });
  } finally {
    rmSync(temp, { force: true });
  }
}
