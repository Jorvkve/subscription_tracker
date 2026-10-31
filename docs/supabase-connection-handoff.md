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

## Next steps

1. In Supabase Dashboard, open **Database → Settings → SSL Configuration** and download the database CA certificate. Save it in the project as `certs/supabase-ca.crt`. This certificate is public; database passwords are not.
2. Update the runtime Prisma adapter in `src/lib/prisma.ts` to trust the downloaded CA. When passing an explicit `ssl` object to node-postgres, remove `sslmode`/`sslrootcert` from the runtime URL passed to the adapter because URL SSL settings override the explicit SSL object. Keep the transaction pooler's `pgbouncer=true` setting.
3. Configure Prisma CLI's `DIRECT_URL` path in `prisma.config.ts` to verify the Supabase server using the CA certificate (`sslmode=verify-full` and `sslrootcert` pointing to the certificate).
4. Re-run a read-only `SELECT 1` using `DATABASE_URL` and `prisma migrate status` using `DIRECT_URL`. Do not run `npm run db:deploy` until both connections succeed.
5. After connectivity is confirmed, apply the checked-in migrations with `npm run db:deploy` if the Supabase database is intended to receive the app schema.

## Security notes

- Never commit `.env`, database passwords, OAuth credentials, or other secret values.
- Do not disable TLS certificate verification as a workaround.
- The previous `SELECT 1` checks were read-only; no database contents or schema were changed.
