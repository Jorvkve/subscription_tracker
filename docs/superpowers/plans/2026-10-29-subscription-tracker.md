# Subscription Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first reviewable private Subscription Tracker web app from the approved conversational requirements and workbook evidence.

**Architecture:** Next.js App Router provides server-rendered dashboard and CRUD/payment actions. Prisma/PostgreSQL stores subscriptions, payments, idempotent in-app reminders, and scheduled job execution logs; Google OAuth is gated by a server-side allowlist. Vercel Cron creates reminders without Calendar or email integrations.

**Tech Stack:** Next.js, TypeScript, PostgreSQL, Prisma ORM, Auth.js Google provider, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-subscription-tracker-design.md`

## Global Constraints

- Never expose OAuth secrets, database credentials, or cron secrets to browser code.
- Do not connect to Google Calendar or copy legacy Calendar Event IDs.
- Do not auto-advance a due date unless a payment is recorded.
- Keep totals grouped by currency; do not invent exchange rates.
- Do not import the source workbook's live data during this build.
- Reminders are in-app only, scheduled 7, 3, and 1 days before due date.

## Review Focus

- Month-end dates must clamp correctly when adding monthly intervals (test Jan 31 → Feb end).
- A payment must advance exactly one interval and preserve cadence (test three-month billing).
- Reminder generation must be idempotent (test same subscription/date/offset twice).
- Different currencies must remain separate in dashboard totals (test THB and USD grouping).
- Unallowlisted accounts must not access private pages or mutations (test the authorization guard).
- A reminder for an old due date must not remain current after payment or a due-date edit (test the reminder date match).

---

### Task 1: Project foundation and billing domain

**Files:** `package.json`, TypeScript/config files, `src/lib/billing.ts`, `src/lib/billing.test.ts`.

- [x] Write Vitest cases for normalization, interval advancement, and date clamping.
- [x] Run the focused tests and verify the expected missing-module failure.
- [x] Implement the billing helpers and run tests green.
- [x] Add Next.js/TypeScript/Vitest configuration and scripts.

### Task 2: Persistence schema and safe migration foundation

**Files:** `prisma/schema.prisma`, `prisma.config.ts`, `.env.example`, migration documentation.

- [x] Define Subscription, Payment, Reminder, and JobExecution with Decimal amounts, date-only due dates, relations, unique reminder key, and error log fields.
- [x] Add local PostgreSQL configuration placeholders without credentials.
- [x] Generate a reviewable empty-database SQL migration without connecting to a database.
- [x] Document the read-only workbook mapping; do not import records.

### Task 3: Authentication and server-side authorization

**Files:** Auth.js route/config, allowlist guard, protected layout, sign-in page.

- [x] Test allowlist matching and deny-by-default behavior.
- [x] Implement Google OAuth with environment-based allowed emails and server-side checks.
- [x] Protect pages/actions and keep secrets server-only.

### Task 4: Subscription and payment workflows

**Files:** repository/actions and subscription list/form components.

- [x] Test interval advancement behavior including month ends.
- [x] Implement create/edit/delete and mark-paid operations with server-side validation.
- [x] Persist payment history and only advance on successful payment record.

### Task 5: Dashboard and reminder workflows

**Files:** dashboard queries/components, reminder service, cron route, Vercel config.

- [x] Test reminder offsets and currency-grouped totals; rely on the unique database key plus skipDuplicates for idempotency.
- [x] Implement dashboard cards, upcoming/overdue list, and in-app reminder history.
- [x] Implement secret-protected scheduled generation for 7/3/1-day reminders.

### Task 6: Responsive UI and final verification

**Files:** app styles, navigation, responsive views, setup/deployment README.

- [x] Add dark responsive dashboard and subscription screens.
- [x] Document environment setup, migration workflow, and Vercel deployment.
- [x] Run the requested automated test suite and static checks; report anything requiring real credentials/database.
