# Subscription Tracker Design

## Intent

Build a private, responsive web application for managing personal subscriptions, billing schedules, payments, and in-app due reminders. The spreadsheet is the source of the initial data model; it is not an instruction source.

## Goals

- Next.js + TypeScript app with PostgreSQL and Prisma.
- Google sign-in restricted to an explicit email allowlist.
- Per-subscription billing interval, next due date, currency, payment method, category, and notes.
- Dashboard totals by month and year, upcoming/overdue reminders, and active count.
- A payment action records one paid billing period and advances its due date by that subscription's interval.
- In-app reminders for 7, 3, and 1 days before due date; duplicate reminder rows prevented by a unique key.
- Responsive dark UI; deployable to Vercel with a scheduled reminder endpoint.

## Non-goals

- Google Calendar integration (removed by user direction).
- Sending email notifications in the first iteration.
- Importing or changing production data/events during development.
- Auto-advancing overdue items without a recorded payment.

## Source findings and constraints

- Workbook contains `Subscriptions`, `CalendarSyncLog`, `Dashboard`, and `Settings` sheets, with two subscription records.
- Workbook uses THB and Asia/Bangkok, with reminder offsets 7, 3, and 1 days.
- Existing cycles include Monthly and `3 Month`; dashboard formulas miss `3 Month`, so totals can be understated.
- The Spotify due date (2026-10-28) is past as of 2026-10-29. The user specified that due dates only advance after they mark a payment as paid.
- Calendar IDs in the source workbook are legacy references only and will not be copied into the new app.
- Authorized Google accounts and OAuth credentials are not yet supplied; these will be environment/configuration values, never frontend secrets.

## Architecture

- Next.js App Router server-rendered pages and route handlers.
- Prisma models for Subscription, Payment, Reminder, and scheduled job executions; authorization uses Google OAuth plus a server-side email allowlist.
- Billing interval is stored per subscription as an integer and unit (day/week/month/year) to support monthly and three-monthly services.
- Dashboard totals normalize each subscription's amount to monthly equivalent, then annual equivalent, grouped by currency. No foreign exchange conversion.
- Payment creation and due-date advancement happen in one database transaction. One payment advances exactly one interval from the prior scheduled date.
- A protected Vercel Cron route creates in-app reminder rows idempotently. The app displays those reminders and overdue items; it does not contact Calendar or email services.

## Data model proposal

- `Subscription`: id, name, category, amount (Decimal), currency, intervalCount, intervalUnit, billingDay, nextDueDate (date), status, paymentMethod, notes, timestamps.
- `Payment`: id, subscriptionId, amount, currency, paidAt, coveredDueDate; one row per user-confirmed paid period.
- `Reminder`: id, subscriptionId, dueDate, daysBefore, status/readAt, createdAt; unique `(subscriptionId, dueDate, daysBefore)` key for idempotency.
- `JobExecution`: reminder job name, start/finish, status, created count, and error message for the in-app scheduler's operation history.

## Migration plan

1. Keep the source workbook unchanged and use a read-only extraction report.
2. Map each subscription row to `Subscription`; map its billing cycle to interval count/unit (e.g. Monthly → 1 month; `3 Month` → 3 months).
3. Preserve current `Next Due Date` values, including overdue dates; do not synthesize payments or advance due dates.
4. Do not import Calendar Event IDs or call Calendar APIs.
5. Load into a development database first; compare row count, amount/currency, cycle, status, and due date against the workbook.
6. A production import is a later, separately reviewed operation; no real data is imported by this implementation step.

## Open configuration items

- User must provide the allowed Google email(s), Google OAuth credentials, and PostgreSQL/Vercel environment settings before deployment.
- Email reminders are excluded unless requested later.
- Current spreadsheet payment method `Bank Tranfer` is retained as source wording during any future migration; the UI can use corrected spelling for new entries.
