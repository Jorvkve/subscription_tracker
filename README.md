# Subscription Tracker

Personal subscription manager built with Next.js, TypeScript, Supabase PostgreSQL, Prisma, and Google sign-in. The app has an in-app dashboard, billing calendar, reminder history, Gmail SMTP reminders, and expense slip management backed by Google Drive. It does not integrate with Google Calendar.

## Local setup

1. Install Node.js 20.19 or newer and create a Supabase project.
2. In Supabase **Database → Settings → SSL Configuration**, download the CA certificate and save it as `certs/supabase-ca.crt`. In **Connect**, copy the **Transaction pooler** URL (port `6543`) to `DATABASE_URL`. Keep `pgbouncer=true`; the project verifies TLS against the downloaded CA. URL-encode reserved characters in the database password.
3. Copy `.env.example` to `.env`. Set `DIRECT_URL` to the Supabase **Direct connection** string for migrations. If the network cannot reach the direct endpoint, use the **Session pooler** string (port `5432`) instead; do not use the transaction pooler for migrations. The server reads the packaged CA file automatically; set `SUPABASE_DB_CA_BASE64` only if your host does not package that file. Then set `AUTH_SECRET`, Google OAuth credentials, `ALLOWED_GOOGLE_EMAILS`, and `CRON_SECRET`. For email, set a Google App Password in `SMTP_APP_PASSWORD`; `SMTP_USER` defaults to the first authorized Google account and can be overridden when the sender is a different account. `REMINDER_EMAIL_TO` defaults to the first authorized email.
4. In Google OAuth settings, add `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/drive/callback` as authorized redirect URIs.
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
- A subscription can store an optional charge time (`HH:mm`), shown on its detail page and in the calendar.
- Expense entries may have no slip image, and any past date can be entered. With `GEMINI_API_KEY` set, a slip image is read with the Gemini API to fill in the amount, date, time, and payee; the image is sent to Google for this. Without the key, entry is manual.

## Work schedule

`/schedule` manages tasks and work shifts, and the Dashboard calendar shows them alongside billing dates.

- Tasks have an optional due date, a priority, and a status. Completed tasks keep their original completion date when edited.
- Shifts store a date with start and end times in app local time. An end time earlier than the start time means the shift ends the next day; it appears on its start date only. A new shift can repeat on chosen weekdays between a start and end date, up to 366 days, creating one independent record per date. After saving, the Dashboard calendar opens on that month and each day shows its shifts.

## Expense slips

`/slips` lets you photograph payment slips and record the details by hand. Images are stored in the user's own Google Drive under the `drive.file` scope — the app can only see files it created itself.

- **Connecting Google Drive**: visit `/api/drive/connect` or click the connect prompt on the Slips page. The OAuth flow stores an encrypted refresh token; access tokens are obtained per-operation and never persisted.
- **Deleted images go to Drive Trash**, not permanently removed, so they can be recovered from Google Drive.
- **Extra OAuth redirect URI**: add `/api/drive/callback` for each environment (e.g. `http://localhost:3000/api/drive/callback` and `https://<your-domain>/api/drive/callback`) to the Google OAuth authorised redirect URI list.
- **Enable the Google Drive API** in the Google Cloud project that hosts the OAuth credentials.
- **OAuth app must be in Production mode**: refresh tokens issued to apps in Testing mode expire after 7 days. Publish the app or add your account to the test-user list while in development, then switch to Production for deployment.

**Planned**: OCR to pre-fill slip fields automatically (search code for `TODO(slip-ocr)`).

## Telegram bot

Record daily expenses from a private chat with your own bot. Entries land in the same expense list as `/slips`, marked `Telegram`.

1. Create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`) and copy its token.
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` (any long random string) in Vercel and `.env`. Leave `TELEGRAM_ALLOWED_CHAT_ID` empty for now, then deploy.
3. Register the webhook:

   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<your-domain>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     -d 'allowed_updates=["message","callback_query"]'
   ```

4. Message the bot. Until an owner is set it only replies with your chat id. Put that id in `TELEGRAM_ALLOWED_CHAT_ID` and redeploy; from then on every other chat is ignored.

Usage:

- `ข้าว 60`, `60 กาแฟ`, `ค่าเช่า 1,200`, `฿45.50`: the amount may come first or last, and Thai digits work. The bot saves it for today and offers category buttons.
- A date in front records a past day: `8/11/2569 อาหาร 50`, `8/11/26 ข้าว 60`, `8/11 ข้าว 60` (this year, or last year if that day is still ahead), `เมื่อวาน กาแฟ 45`. Buddhist and Christian years both work. Future and impossible dates are refused. Past entries have no time.
- A slip photo with a caption such as `350 ค่าไฟ` (or `8/11 350 ค่าไฟ`), or a reply to an earlier photo with the amount: the image is stored in Drive like web uploads, so Google Drive must be connected on `/slips`.
- A slip photo with no amount: when `GEMINI_API_KEY` is set, the bot reads the amount, date, time, and payee from the slip and saves them, saying "อ่านจากสลิป" so a wrong reading can be removed with `/undo`. A caption amount always wins over the reading.
- `/today`, `/month` (expenses by category, plus subscription payments), `/undo` (lists up to 8 bot entries from the last 7 days as buttons; picking one asks for confirmation, then deletes it and moves its image to Drive trash), `/help`.

Each update id is recorded in `TelegramUpdate`, so Telegram retries never create duplicates.

## Deployment

Deploy the repository to Vercel and configure the environment variables above for each environment. For Gmail SMTP, enable 2-Step Verification and create a Google App Password; never use your normal Google password. Configure Google OAuth's production redirect URI as `https://<your-domain>/api/auth/callback/google` and `https://<your-domain>/api/drive/callback`. `vercel.json` runs reminder generation daily at 01:00 Asia/Bangkok (18:00 UTC). The cron route requires `Authorization: Bearer <CRON_SECRET>`; Vercel Cron supplies this header when the same `CRON_SECRET` project variable is configured.

Create a Supabase project and configure Vercel's `DATABASE_URL` with the Supabase Transaction pooler string (port `6543`, with `pgbouncer=true`) for serverless application traffic. Keep `certs/supabase-ca.crt` in the deployment or set `SUPABASE_DB_CA_BASE64` in Vercel as a server-side override. Add the other server-side environment variables described above. Do not put `DIRECT_URL` in the browser or a `NEXT_PUBLIC_` variable. Run `npm run db:deploy` from a trusted machine with the CA file at `certs/supabase-ca.crt` and `DIRECT_URL` set to the Supabase Direct connection or Session pooler string. This applies checked-in migrations without creating a new migration. This project does not create a Supabase project or deploy itself.

## Spreadsheet import

Spreadsheet import is intentionally not included. Add and manage subscriptions manually through the web interface.

## Commands

- `npm run dev` — local development server
- `npm test` — unit tests
- `npm run lint` — ESLint
- `npm run db:generate` — generate Prisma client
- `npm run db:migrate -- --name <migration>` — create/apply a development migration (requires `DIRECT_URL`)
- `npm run db:deploy` — apply checked-in migrations to the configured database (requires `DIRECT_URL`)
