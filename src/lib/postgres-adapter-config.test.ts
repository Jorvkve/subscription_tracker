import { describe, expect, it } from "vitest";
import { buildPostgresAdapterConfig } from "@/lib/postgres-adapter-config";

const certificate = "-----BEGIN CERTIFICATE-----\nunit-test-certificate\n-----END CERTIFICATE-----";

describe("PostgreSQL adapter configuration", () => {
  it("keeps local connection strings unchanged when no CA is configured", () => {
    const connectionString = "postgresql://user:pass@localhost:5432/subscriptions";

    expect(buildPostgresAdapterConfig(connectionString)).toEqual({ connectionString });
  });

  it("uses the supplied CA and preserves strict TLS verification", () => {
    const config = buildPostgresAdapterConfig(
      "postgresql://user:pass@aws-1-region.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&sslrootcert=old.crt",
      Buffer.from(certificate).toString("base64"),
    );

    expect(config.connectionString).toBe(
      "postgresql://user:pass@aws-1-region.pooler.supabase.com:6543/postgres?pgbouncer=true",
    );
    expect(config.ssl).toEqual({ ca: certificate, rejectUnauthorized: true });
  });

  it("rejects invalid certificate content instead of disabling verification", () => {
    expect(() => buildPostgresAdapterConfig(
      "postgresql://user:pass@db.example.com:5432/postgres",
      Buffer.from("not a certificate").toString("base64"),
    )).toThrow("SUPABASE_DB_CA_BASE64 must contain a PEM certificate.");
  });
});
