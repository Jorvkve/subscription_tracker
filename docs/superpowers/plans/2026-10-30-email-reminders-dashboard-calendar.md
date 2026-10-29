# Email Reminders and Dashboard Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send active subscription reminders by SMTP 7/3/1 days before billing dates and show a navigable billing calendar on the Dashboard.

**Architecture:** Extend Reminder with email delivery state and use an atomic database claim before SMTP send. Generate internal calendar events from active subscriptions and Payment.coveredDueDate, then render an accessible responsive month grid with selected-day details on Dashboard.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7/PostgreSQL, Nodemailer, Vitest, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-10-30-email-reminders-dashboard-calendar-design.md`

## Global Constraints

- Keep SMTP values server-side in `.env`/deployment environment variables; never use `NEXT_PUBLIC_`.
- Keep the existing daily cron, 7/3/1 schedule, and Asia/Bangkok date calculation.
- Existing Reminder rows receive a non-sendable default so migration never emails historic records.
- No Google Calendar calls and no Excel reads/imports.
- Do not change the rule that dates advance only after manual payment.

## Review Focus

- Concurrent cron requests must claim each email once: test one successful atomic claim and one rejected competing claim.
- Missing SMTP settings must preserve in-app reminders and record configuration failure without leaking secrets.
- Failed SMTP attempts must record a sanitized error and must not be resent automatically.
- Month-end and leap-year calendar grids must keep correct YYYY-MM-DD dates.
- Overdue unpaid subscriptions must not project future recurring events; payment history must remain visible as paid.

## Task 1: Delivery model and reminder email logic

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/reminder-email.ts`
- Create: `src/lib/reminder-email.test.ts`
- Modify: `.env.example`
- Modify: `package.json` and lockfile (Nodemailer runtime and types)
- Generate: Prisma migration and Prisma Client

**Interfaces:**
- `buildReminderEmail(input)` returns a plain-text and HTML message from subscription name, amount/currency, due date, billing interval, and days-before count.
- `sendReminderEmail(input, transport)` awaits one SMTP send; transport injection allows deterministic unit tests.
- `Reminder.emailStatus` transitions through `NOT_QUEUED`, `PENDING`, `SENDING`, `SENT`, `ERROR`, `SKIPPED`.

- [ ] Write tests proving the subject/body includes due date, amount, cycle, and 7/3/1 offset; HTML escapes user content; missing mail config is rejected without sending.
- [ ] Run `npm test -- src/lib/reminder-email.test.ts` and confirm the expected RED failure.
- [ ] Add the additive Reminder enum/fields with `NOT_QUEUED` default and a migration; install Nodemailer; implement the message builder and sender with SMTP env config.
- [ ] Run the focused test and confirm GREEN, then generate Prisma Client and apply the migration to the development database.

## Task 2: Idempotent scheduled email delivery

**Files:**
- Modify: `src/app/api/cron/reminders/route.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/activity/page.tsx`
- Modify: `src/lib/reminders.test.ts`

**Interfaces:**
- Cron creates missing in-app reminders as before, queues only reminders whose due date still matches an active subscription, atomically claims PENDING emails as SENDING, sends once, and records SENT or ERROR. Missing SMTP config leaves in-app reminders intact and records an explicit error.
- Payment or due-date edits mark unsent reminders SKIPPED so stale emails are not sent after a schedule change.

- [ ] Add tests for reminder queue eligibility and duplicate claims before production changes.
- [ ] Implement delivery claiming/status updates and sanitized per-email/JobExecution errors; do not auto-retry ambiguous SMTP failures.
- [ ] Add delivery status and safe error summaries to Activity history.
- [ ] Run focused reminder/email tests and inspect migration/data preservation.

## Task 3: Dashboard billing calendar

**Files:**
- Create: `src/lib/calendar.ts`
- Create: `src/lib/calendar.test.ts`
- Create: `src/components/dashboard-calendar.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `buildCalendarEvents({month, today, subscriptions, payments})` returns date-keyed DUE/OVERDUE/PROJECTED/PAID events.
- Dashboard page reads the optional `month` search parameter using Next.js 16 promise-based `searchParams`, queries selected-month paid history, and passes only the chosen month’s events to the client calendar.
- Calendar month navigation uses `/?month=YYYY-MM`; selecting a day lists service, amount/currency, and links to the subscription detail page.

- [ ] Write tests for leap/month-end grids, multiple events in a day, unpaid overdue behavior, projected recurring events, and settled payments.
- [ ] Run focused calendar tests and confirm RED.
- [ ] Implement calendar projection, server queries, responsive month grid, selected-day details, and previous/next navigation.
- [ ] Run focused calendar tests and confirm GREEN.

## Task 4: Documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Verify: all changed application and migration files

- [ ] Document Gmail App Password setup, server-only SMTP env keys, daily schedule, and calendar behavior; do not put secrets in examples.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, `npm run db:generate`, and `prisma migrate status` against the local development database.
- [ ] Inspect the final diff and confirm no workbook access, calendar integration, credential output, or destructive database operation.
