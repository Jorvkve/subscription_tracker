# Supabase Connection Handoff

## Current state

- Supabase PostgreSQL support and setup instructions are in commit `221f07c` (`chore: configure Supabase PostgreSQL support`).
- `.env` is local and ignored by Git. It contains the connection URLs; do not copy credentials into this file or commit them.
- The user reports that the Supabase database password was reset.
- The Supabase project reports Healthy, Network Restrictions allow all IP addresses, and there are no banned IPs.
- TCP checks reached the shared pooler on ports `5432` and `6543`.
- A read-only `SELECT 1` using the current `DATABASE_URL` failed with `SELF_SIGNED_CERT_IN_CHAIN`.
- Node's `pg` driver emitted a warning that it treats `sslmode=require` as certificate verification. No Supabase CA certificate is present in the repository yet.
- No schema migration has been applied to Supabase. `npm run db:deploy` has not been run.
- Runtime PostgreSQL adapter support for the Supabase CA is implemented via `SUPABASE_DB_CA_BASE64`; Prisma CLI adds the local `certs/supabase-ca.crt` path when that file exists.

## Next steps

1. In Supabase Dashboard, open **Database → Settings → SSL Configuration** and download the database CA certificate. Save it as `certs/supabase-ca.crt`. The certificate is public; database passwords are not.
2. Set `SUPABASE_DB_CA_BASE64` to the Base64-encoded certificate for the runtime (Vercel environment variables). Keep `DATABASE_URL` on the Transaction pooler and retain `pgbouncer=true`.
3. For Prisma CLI, use the Direct connection or Session pooler in `DIRECT_URL`. The Prisma config sets `sslmode=verify-full` and `sslrootcert` to the downloaded file when present.
4. Re-run a read-only `SELECT 1` using `DATABASE_URL` and `prisma migrate status` using `DIRECT_URL`. Do not run `npm run db:deploy` until both connections succeed.
5. After connectivity is confirmed, apply the checked-in migrations with `npm run db:deploy` if the Supabase database is intended to receive the app schema.

## Security notes

- Never commit `.env`, database passwords, OAuth credentials, or other secret values.
- Do not disable TLS certificate verification as a workaround.
- The previous `SELECT 1` checks were read-only; no database contents or schema were changed.
