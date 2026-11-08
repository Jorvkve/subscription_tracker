# Project status

Handoff for any agent or person picking this up. Last updated 2026-11-08.

## Where things run

- App: Vercel, `https://subscriptiontracker-gilt.vercel.app`, deployed from `main`.
- Database: Supabase PostgreSQL, all 6 migrations applied (`20261109000000_add_reminder_telegram_delivery` on 2026-11-08). A local PostgreSQL copy on the owner's PC is a stale fallback.
- Slip images: the owner's Google Drive, app-created `Subtrack Slips` folder, `drive.file` scope, files named `DD-MM-YYYY_HH-mm`.
- Telegram bot: `@subtrack_jorv_bot`, webhook `https://subscriptiontracker-gilt.vercel.app/api/telegram/webhook`, registered with a secret token. Env vars `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_CHAT_ID` are set in Vercel and `.env`.

## Done

- Subscriptions, billing cycles, optional charge time, reminders (email).
- Tasks and work shifts in `/schedule`; shifts repeat on chosen weekdays between dates and show in the Dashboard calendar.
- Expense slips in `/slips`; the image is optional, and `ExpenseSlip.source` is `WEB` or `TELEGRAM`.
- UI pass: IBM Plex Sans Thai, Phosphor icons, phone bottom navigation.
- Telegram bot: `ข้าว 60` style entries with category buttons, slip photos with the amount in the caption or a reply, `/today`, `/month`, and `/undo`, which lists up to 8 bot entries from 7 days and confirms before deleting. Code is in `src/lib/telegram*.ts` and the webhook route.
- Subscription reminders through Telegram (deployed 2026-11-08): the daily cron sends each 7/3/1-day reminder to the owner's chat with a "จ่ายแล้ว" button. The button pays only the cycle the reminder was for, so a repeat or late tap reports "รอบนี้บันทึกการจ่ายไปแล้ว". The web "mark paid" action and the bot share `src/lib/subscription-payment.ts`. Delivery is tracked in `Reminder.telegramAttemptedAt/SentAt/ErrorCode` and shown on the "ประวัติและระบบ" page.

## Not yet confirmed

- Telegram reminders: deployed, but no reminder has been sent yet. Check the first one and the "จ่ายแล้ว" tap.

- Reminder email: the cron route has never been seen running in production. Check the "ประวัติและระบบ" page.
- The `/undo` picker passed tests but was not yet tried in the live bot when this was written.

## Proposed next, owner to choose

Small items:
- Pin `engines.node` to `22.x`.
- Prune `TelegramUpdate` rows older than 30 days in the daily cron.
- Add a "ใช้ไปเดือนนี้" metric card on the Dashboard from `ExpenseSlip`.

Features:
- Editing an amount from the bot.
- A nightly summary; check Vercel Hobby cron limits first.
- Monthly budgets per category.
- OCR for slips, marked `TODO(slip-ocr)`.
- Editing repeated shifts as a series.

## Decisions from the owner

- Single-user app. The owner will not rotate the database password or bot token; do not raise it again.
- Keep the `Subtrack Slips` Drive folder rather than a folder of the owner's own, which would need the full Drive scope.
- Push to `main` only when the owner asks; it deploys production.

## Working agreement

- Claude directs and reviews; implementation goes through `agy -p` with Gemini when quota allows. Gemini's quota ran out on 2026-11-07 for about 7 days, so the owner had Claude take over implementation.
- `agy` headless runs end on any denied shell command and can still report success, so verify results from the files. Allow only the exact check commands.
- Every check includes `npm run build`. Client components must not import Prisma, directly or indirectly.
- Compare each migration with `prisma migrate diff` before applying it. Applying to Supabase needs the owner's go-ahead.
- In PowerShell, pass commit messages that contain double quotes through `git commit -F <file>`.
