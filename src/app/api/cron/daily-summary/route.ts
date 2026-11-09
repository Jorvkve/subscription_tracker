import { NextRequest } from "next/server";
import { JobStatus, SubscriptionStatus } from "@/generated/prisma/client";
import { monthBudgetLines } from "@/lib/budget-data";
import { buildDailySummary } from "@/lib/daily-summary";
import { addDays, appDateString, utcDate } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";
import { readTelegramConfig } from "@/lib/telegram-auth";

// Runs once each evening (see vercel.json) and sends the day's spending to the owner's Telegram chat.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getPrisma();
  const run = await db.jobExecution.create({ data: { jobName: "daily-summary" } });
  const finish = (status: JobStatus, errorMessage: string | null, sent: number) =>
    db.jobExecution.update({
      where: { id: run.id },
      data: { status, finishedAt: new Date(), createdCount: sent, errorMessage },
    });

  const telegram = readTelegramConfig(process.env);
  const chatId = telegram.token && telegram.allowedChatId ? Number(telegram.allowedChatId) : Number.NaN;
  if (!Number.isSafeInteger(chatId)) {
    await finish(JobStatus.ERROR, "TELEGRAM_NOT_CONFIGURED", 0);
    return Response.json({ error: "Telegram is not configured." }, { status: 503 });
  }

  try {
    const today = appDateString();
    const tomorrow = addDays(today, 1);
    const month = today.slice(0, 7);
    const [items, monthRows, budgets, shifts, dues] = await Promise.all([
      db.expenseSlip.findMany({
        where: { paidDate: utcDate(today) },
        orderBy: [{ paidTime: "asc" }, { createdAt: "asc" }],
        select: { amount: true, currency: true, paidTime: true, payee: true, note: true, category: true },
      }),
      db.expenseSlip.findMany({
        where: { currency: "THB", paidDate: { gte: utcDate(`${month}-01`), lte: utcDate(today) } },
        select: { amount: true },
      }),
      monthBudgetLines(month).catch(() => []),
      db.workShift.findMany({
        where: { date: utcDate(tomorrow) },
        orderBy: { startTime: "asc" },
        select: { title: true, startTime: true, endTime: true, location: true },
      }),
      db.subscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE, nextDueDate: utcDate(tomorrow) },
        select: { name: true, price: true, currency: true },
      }),
    ]);

    const text = buildDailySummary({
      date: today,
      items: items.map((row) => ({
        amount: Number(row.amount),
        currency: row.currency,
        time: row.paidTime,
        title: row.payee || row.note,
        category: row.category,
      })),
      monthTotal: monthRows.reduce((sum, row) => sum + Number(row.amount), 0),
      budgets,
      tomorrowShifts: shifts,
      dueTomorrow: dues.map((row) => ({ name: row.name, amount: Number(row.price), currency: row.currency })),
    });
    await sendMessage(chatId, text);
    await finish(JobStatus.SUCCESS, null, 1);
    return Response.json({ sent: true, items: items.length });
  } catch (error) {
    // Telegram errors name only the method and status, so the message is safe to store.
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    await finish(JobStatus.ERROR, message, 0);
    return Response.json({ error: "Daily summary failed. See activity log." }, { status: 500 });
  }
}
