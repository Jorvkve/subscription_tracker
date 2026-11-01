# Subscription Tracker

Personal subscription manager built with Next.js, TypeScript, Supabase PostgreSQL, Prisma, and Google sign-in. The app has an in-app dashboard, billing calendar, reminder history, and Gmail SMTP reminders. It does not integrate with Google Calendar.

## Local setup

1. Install Node.js 20.19 or newer and create a Supabase project.
2. In Supabase **Database → Settings → SSL Configuration**, download the CA certificate and save it as `certs/supabase-ca.crt`. In **Connect**, copy the **Transaction pooler** URL (port `6543`) to `DATABASE_URL`. Keep `pgbouncer=true`; the project verifies TLS against the downloaded CA. URL-encode reserved characters in the database password.
3. Copy `.env.example` to `.env`. Set `DIRECT_URL` to the Supabase **Direct connection** string for migrations. If the network cannot reach the direct endpoint, use the **Session pooler** string (port `5432`) instead; do not use the transaction pooler for migrations. Set `SUPABASE_DB_CA_BASE64` to the Base64 output of `certs/supabase-ca.crt` for the serverless runtime (on Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('certs/supabase-ca.crt'))`). Then set `AUTH_SECRET`, Google OAuth credentials, `ALLOWED_GOOGLE_EMAILS`, and `CRON_SECRET`. For email, set `SMTP_USER` and a Google App Password in `SMTP_APP_PASSWORD`; `REMINDER_EMAIL_TO` defaults to the first authorized email.
4. In Google OAuth settings, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
5. Run `npm install`, then `npm run db:generate`.
6. Apply the existing schema to the Supabase database with `npm run db:deploy`.
7. Run `npm run dev` and open `http://localhost:3000`.

Do not import workbook data or legacy Calendar Event IDs; enter subscription records manually.

## Authentication

Google login requires a verified email listed in `ALLOWED_GOOGLE_EMAILS` as a comma-separated server-side environment variable. OAuth credentials, `AUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, SMTP credentials, and `CRON_SECRET` must remain server-side and must not use a `NEXT_PUBLIC_` prefix. An empty allowlist denies every account.

## Data and billing behavior

- Billing interval is stored on each subscription as an interval count and unit. For example, Spotify can use 3 months while iCloud uses 1 month.
- Dashboard monthly and annual figures are normalized recurring-cost estimates grouped by currency. There is no exchange-rate conversion.
- Overdue dates remain unchanged until “บันทึกว่าจ่ายแล้ว” creates a Payment record. That transaction advances exactly one interval from the previous scheduled date, preserving the configured billing day where possible.
- Deleting a subscription permanently removes its payment and reminder history through database cascades; the UI asks for confirmation.
- In-app and email reminders are generated for 7, 3, and 1 days before each active subscription's due date. Database uniqueness and an atomic email status claim prevent duplicate sends. A failed or ambiguous SMTP attempt is logged and is not automatically retried.
- The Dashboard calendar shows current due dates, overdue items, projected future cycles, and paid billing dates. Selecting a day displays subscription details.
- Scheduled job runs and sanitized error messages are retained in `JobExecution`.

## Deployment

Deploy the repository to Vercel and configure the environment variables above for each environment. For Gmail SMTP, enable 2-Step Verification and create a Google App Password; never use your normal Google password. Configure Google OAuth's production redirect URI as `https://<your-domain>/api/auth/callback/google`. `vercel.json` runs reminder generation daily at 01:00 Asia/Bangkok (18:00 UTC). The cron route requires `Authorization: Bearer <CRON_SECRET>`; Vercel Cron supplies this header when the same `CRON_SECRET` project variable is configured.

Create a Supabase project and configure Vercel's `DATABASE_URL` with the Supabase Transaction pooler string (port `6543`, with `pgbouncer=true`) for serverless application traffic. Set `SUPABASE_DB_CA_BASE64` in Vercel to the Base64 CA value generated from the downloaded certificate; keep it server-side. Add the other server-side environment variables described above. Do not put `DIRECT_URL` in the browser or a `NEXT_PUBLIC_` variable. Run `npm run db:deploy` from a trusted machine with the CA file at `certs/supabase-ca.crt` and `DIRECT_URL` set to the Supabase Direct connection or Session pooler string. This applies checked-in migrations without creating a new migration. This project does not create a Supabase project or deploy itself.

## Spreadsheet import

Spreadsheet import is intentionally not included. Add and manage subscriptions manually through the web interface.

## Commands

- `npm run dev` — local development server
- `npm test` — unit tests
- `npm run lint` — ESLint
- `npm run db:generate` — generate Prisma client
- `npm run db:migrate -- --name <migration>` — create/apply a development migration (requires `DIRECT_URL`)
- `npm run db:deploy` — apply checked-in migrations to the configured database (requires `DIRECT_URL`)
