# Email Reminders and Dashboard Calendar Design

**Intent:** Add scheduled email reminders and a navigable in-app billing calendar to the existing personal subscription tracker.

**Goals:** Send reminders 7, 3, and 1 day before each active subscription due date; show due, overdue, projected, and already-paid billing events on the Dashboard calendar; preserve the current manual payment flow and in-app reminders; keep credentials server-side; prevent duplicate sends from repeated or concurrent cron runs; record delivery status and sanitized errors.

**Non-goals:** Google Calendar integration, spreadsheet import, changing billing semantics, email preference management, or sending payment confirmation emails.

**Constraints:** Next.js/TypeScript, PostgreSQL/Prisma, current daily Vercel Cron, Asia/Bangkok date handling, Google allowlist auth. Existing reminder/payment/subscription history must remain intact. Email config is environment-only and never exposed to browser code.

**Approaches:** (1) Gmail SMTP via Nodemailer: no additional provider account/domain; needs a Google App Password and SMTP settings; database claim/status provides at-most-once attempts. (2) Transactional email API (such as Resend): HTTP-based and provider idempotency support, but adds a third party and sender/domain setup. (3) Google Gmail API: avoids SMTP password but requires broader Google OAuth scopes and consent work. Choose Gmail SMTP for this single-user app to avoid another paid service/account; keep mail transport isolated so it can be replaced later.

**Design calls:** Use the authorized account email as the default notification recipient, overridable only by a server-side `REMINDER_EMAIL_TO`. Store email delivery state on each existing Reminder row, using an atomic PENDING-to-SENDING claim and never automatically retry an ambiguous SMTP attempt. Record ERROR/SENT/SKIPPED states and sanitized error codes. The Dashboard calendar is an internal month view: current pending due date, projected later occurrences for active non-overdue subscriptions, and paid occurrences from Payment.coveredDueDate. A paid subscription advances according to existing billing logic; past-due subscriptions do not project another cycle until manually paid.

**What remains to the builder:** Add additive Prisma fields/migration, SMTP sender and cron integration, calendar date projection and UI, activity delivery status, docs, tests, then ask the user to provide their own Gmail App Password in `.env` without sharing it in chat.
