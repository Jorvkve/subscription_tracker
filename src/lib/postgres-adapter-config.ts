import type { PoolConfig } from "pg";

export function buildPostgresAdapterConfig(
  connectionString: string,
  caBase64?: string,
): PoolConfig {
  if (!caBase64) return { connectionString };

  const ca = Buffer.from(caBase64, "base64").toString("utf8");
  if (!ca.includes("-----BEGIN CERTIFICATE-----") || !ca.includes("-----END CERTIFICATE-----")) {
    throw new Error("SUPABASE_DB_CA_BASE64 must contain a PEM certificate.");
  }

  const url = new URL(connectionString);
  for (const option of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    url.searchParams.delete(option);
  }

  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true },
  };
}
