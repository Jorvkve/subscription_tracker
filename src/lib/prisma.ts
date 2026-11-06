import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  buildPostgresAdapterConfig,
  resolveSupabaseCaBase64,
} from "@/lib/postgres-adapter-config";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access subscription data.");
  }

  const caPath = resolve(process.cwd(), "certs/supabase-ca.crt");
  const caFileContents = existsSync(caPath) ? readFileSync(caPath, "utf8") : undefined;
  const caBase64 = resolveSupabaseCaBase64(
    connectionString,
    process.env.SUPABASE_DB_CA_BASE64,
    caFileContents,
  );
  const adapter = new PrismaPg(buildPostgresAdapterConfig(connectionString, caBase64));
  const prisma = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  return prisma;
}
