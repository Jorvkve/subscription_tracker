# Project status

Handoff for any agent or person picking this up. Last updated 2026-11-09.

## Where things run

- App: Vercel, `https://subscriptiontracker-gilt.vercel.app`, deployed from `main`.
- Database: Supabase PostgreSQL, all 7 migrations applied (latest `20261110000000_add_category_budgets` on 2026-11-09). A local PostgreSQL copy on the owner's PC is a stale fallback.
- Slip images: the owner's Google Drive, app-created `Subtrack Slips` folder, `drive.file` scope, files named `DD-MM-YYYY_HH-mm`.
- Telegram bot: `@subtrack_jorv_bot`, webhook `https://subscriptiontracker-gilt.vercel.app/api/telegram/webhook`, registered with a secret token. Env vars `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_CHAT_ID` are set in Vercel and `.env`.

## Done

- Subscriptions, billing cycles, optional charge time, reminders (email).
- Tasks and work shifts in `/schedule`; shifts repeat on chosen weekdays between dates and show in the Dashboard calendar.
- Expense slips in `/slips`; `ExpenseSlip.source` is `WEB` or `TELEGRAM`. The image is optional on the web form too, since 2026-11-09 (before that the schema allowed it but the form and `createSlip` still required one). Without a Drive connection the form still saves, without the image field.
- UI pass: IBM Plex Sans Thai, Phosphor icons, phone bottom navigation.
- Page structure (2026-11-11): signed-in pages live in the `src/app/(app)/` route group. Its `layout.tsx` checks the session and draws `AppShell` once, so the menu stays on screen between pages. `NavLinks` highlights the tab from the URL. Do not wrap pages in `AppShell` again. `loading.tsx` skeletons (`PageSkeleton`) cover `/`, `/slips`, `/subscriptions`, `/schedule`, and a default for the rest. `experimental.staleTimes.dynamic = 30` keeps visited pages in the client cache for 30 seconds. Functions run in `sin1` next to the database (`vercel.json`).
- Neon dark redesign (deployed 2026-11-09): new shell and Dashboard (spend donut, weekly shift pills, subscription switches, due soon, alerts), restyled Money Tracker, Subs and Shift Calendar, a quick-add expense form on `/slips`, and placeholder Goals and Perks pages. The slip form was checked against the new look after the merge. The Dashboard has the "ใช้ไปเดือนนี้" card. On `/schedule` the work shifts list is one compact row per shift, upcoming first with past shifts folded away, capped in height with its own scroll.
- Telegram bot: `ข้าว 60` style entries with category buttons, slip photos with the amount in the caption or a reply, `/today`, `/month`, and `/undo`, which lists up to 8 bot entries from 7 days and confirms before deleting. Code is in `src/lib/telegram*.ts` and the webhook route.
- Backdated bot entries (deployed 2026-11-09, commit 3c98dac): a leading date such as `8/11/2569 อาหาร 50`, `8/11 ข้าว 60` (this year, or last year if that date is still ahead), or a relative day anywhere in the text: `เมื่อวาน`/`เมื่อวานนี้`/`วานนี้` is today −1 and `วานซืน` today −2 (`กาแฟ 45 เมื่อวาน`, `ข้าวเมื่อวาน 60`). The relative word is left out of the note. Buddhist and Christian years both work; future and impossible dates are refused. Backdated entries are saved without a time. Photo captions accept the same format. Parsing is `parseEntry` in `src/lib/telegram-parse.ts`.
- Slip reading with Gemini (deployed 2026-11-09, commit 3c98dac): `src/lib/slip-ocr.ts` calls the Gemini REST API with `GEMINI_API_KEY` and an optional `GEMINI_MODEL` (default `gemini-flash-lite-latest`; full Flash took over 75 s per slip on 2026-11-09). The bot reads a photo only when its caption or reply has no amount, then saves the amount, date, time, and payee and says "อ่านจากสลิป"; a caption amount always wins. On the web, choosing an image fills the form for the owner to check. Without the key both fall back to manual entry. The key is in the local `.env` (2026-11-09) and a generated test slip read correctly through `readSlip`; the owner added it to Vercel and redeployed the same day.
- Album retries (deployed 2026-11-09): the owner sent several slips at once and some got "บันทึกไม่สำเร็จ", which forced a resend. The cause was not visible because the log held only the error name. Now each photo step (Telegram download, Drive upload, database insert, Gemini on 429/5xx/timeout) is retried twice with jittered waits via `src/lib/retry.ts`, and the log line names the error and its first message line. A photo that still fails gets a reply with a "ลองใหม่" button that runs it again from the replied-to photo, so no resend is needed. Ten parallel Gemini reads of a test slip all succeeded.
- Monthly budgets per category (deployed 2026-11-09): `CategoryBudget` holds one THB amount per category key. The "งบรายเดือน" card on `/slips` shows bars per category and has the form that sets budgets; an empty field removes a budget. A payment exactly equal to its budget (such as rent) shows as "ครบงบ" rather than a warning. The bot warns once when a category crosses 80% and once when it goes over. It checks when a category button is tapped (new bot entries start in อื่นๆ) and when `/edit` raises an amount. `/month` lists the budgets.
- Categories are the owner's own budget items (2026-11-10), with these monthly budgets totalling ฿19,125: ค่ากิน 5,000 · ค่าห้อง 5,500 · ค่าน้ำมัน 550 · ค่าเน็ต 676.93 · ค่าซักผ้า 240 · เงินเก็บ 4,000 · ค่าน้ำค่าไฟ 1,500 · หุ้น 1,000 · ฉุกเฉิน 261.74 · จ่ายบิล 147.33 · บิลรายเดือน 249. A twelfth category, อื่นๆ, is the catch-all with no budget. They are defined with keys and emojis in `src/lib/expense-categories.ts`. Rows store the Thai label; old names (อาหาร, เดินทาง, บิลและค่าบริการ, ...) still map to the nearest new category. On 2026-11-10 all 29 existing entries were moved by a one-off script, matched by payee and amount where clear: the 5,500 to ปนัดดา became ค่าห้อง, the electricity bill ค่าน้ำค่าไฟ, Plum Condo 240 ค่าซักผ้า, DIME หุ้น, the 699 bill ค่าเน็ต, 99 and 145 บิลรายเดือน, other old bills จ่ายบิล, อาหาร ค่ากิน, and เดินทาง ค่าน้ำมัน. The 700 to ณิชาภัทร moved to ค่าน้ำมัน with the rest of เดินทาง, but it may not be fuel.
- Nightly summary (deployed 2026-11-09): a second Vercel cron, `/api/cron/daily-summary` at `0 14 * * *` (21:00–21:59 Bangkok, since Hobby crons run once a day anywhere within the hour), sends today's entries, the month total, budgets, and tomorrow's shifts and due subscriptions to Telegram. Runs are logged as `daily-summary` on the activity page. A manual production run on 2026-11-09 sent it (2 entries that day), and the scheduled runs on 2026-11-10 and 2026-11-11 succeeded.
- Shift edit and delete scopes (deployed 2026-11-09): like Google Calendar, editing or deleting a shift offers this shift, this and following, or all similar. "Similar" means the same title, start, end, and location (`src/lib/shift-series.ts`), so shifts created before this change group without a schema change. Edits to other shifts keep each shift's own date. Tested on throwaway shifts in December, which were then deleted.
- Editing an amount from the bot (deployed 2026-11-09): `/edit` lists the same recent bot entries as `/undo`; picking one sends a prompt with a forced reply, and replying with an amount alone (`55`, `1,250 บาท`) updates it. The prompt ends with `รหัสรายการ <id>`, which is how the reply finds the entry without stored state. Only `TELEGRAM` entries can be edited.
- Subscription reminders through Telegram (deployed 2026-11-08): the daily cron sends each 7/3/1-day reminder to the owner's chat with a "จ่ายแล้ว" button. The button pays only the cycle the reminder was for, so a repeat or late tap reports "รอบนี้บันทึกการจ่ายไปแล้ว". The web "mark paid" action and the bot share `src/lib/subscription-payment.ts`. Delivery is tracked in `Reminder.telegramAttemptedAt/SentAt/ErrorCode` and shown on the "ประวัติและระบบ" page.

## Not yet confirmed

- The first budget warning has not been seen yet.
- Otherwise nothing open. On 2026-11-09 the owner confirmed in the live bot and on the web: the "จ่ายแล้ว" button, `/edit`, `/undo`, backdated entries, and Gemini slip reading in Telegram and on the web form. The reminder email and the Telegram reminder were confirmed by a manual production cron run. The test subscription "ทดสอบ Telegram (ลบได้)" and the test expense were deleted afterwards.
- Tip: to post a test update to the webhook from Git Bash, write the JSON to a UTF-8 file and send it with `--data-binary @file`. Thai text in a command-line argument arrives garbled.

## Proposed next, owner to choose

Small items:
- None open. Done 2026-11-09: `engines.node` is `22.x`, the daily cron deletes `TelegramUpdate` rows older than 30 days, and the Dashboard has the "ใช้ไปเดือนนี้" card.

Features:
- Goals and Perks pages are placeholders; the owner has not said what they should hold.

## Decisions from the owner

- Single-user app. The owner will not rotate the database password or bot token; do not raise it again.
- Keep the `Subtrack Slips` Drive folder rather than a folder of the owner's own, which would need the full Drive scope.
- Push to `main` only when the owner asks; it deploys production.

## Working agreement

- Claude directs and reviews; implementation goes through `agy -p` with Gemini when quota allows. Gemini's quota ran out on 2026-11-07 for about 7 days, so the owner had Claude take over implementation.
- `agy` headless runs end on any denied shell command and can still report success, so verify results from the files. Allow only the exact check commands.
- Every check includes `npm run build`. The local dev server on this D: drive often keeps serving old CSS after `globals.css` changes: stop it, delete `.next/dev`, and start it again. Client components must not import Prisma, directly or indirectly.
- Compare each migration with `prisma migrate diff` before applying it. Applying to Supabase needs the owner's go-ahead.
- In PowerShell, pass commit messages that contain double quotes through `git commit -F <file>`.
