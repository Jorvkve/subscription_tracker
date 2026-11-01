import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

const caPath = resolve(process.cwd(), "certs/supabase-ca.crt");
const directUrl =
  process.env.DIRECT_URL ??
  "postgresql://subscription:subscription@localhost:5432/subscription_tracker";
const datasourceUrl = new URL(directUrl);
if (existsSync(caPath) && /\.supabase\.(?:co|com)$/.test(datasourceUrl.hostname)) {
  datasourceUrl.searchParams.set("sslmode", "verify-full");
  datasourceUrl.searchParams.set("sslrootcert", caPath);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI operations need a direct or session-mode connection. When the
    // Supabase CA file is available, verify both the certificate and hostname.
    url: datasourceUrl.toString(),
  },
});
