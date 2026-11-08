import { NextRequest } from "next/server";
import {
  JobStatus,
  ReminderEmailStatus,
  SubscriptionStatus,
} from "@/generated/prisma/client";
import { addDays, appDateString, dateOnly, utcDate } from "@/lib/dates";
import { createReminderTransport, readReminderMailConfig, sendReminderEmail } from "@/lib/reminder-email";
import { dueReminderOffsets, reminderEmailEligible, reminderSendable } from "@/lib/reminders";
import { getPrisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/telegram";
import { readTelegramConfig } from "@/lib/telegram-auth";
import { buildPaidKeyboard, buildReminderText } from "@/lib/telegram-reminder";

function redactError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown scheduler error";
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s'\"]+/gi, "postgresql://[redacted]")
    .replace(/([?&](?:password|token|secret)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 2000);
}

function emailErrorCode(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  return /^[A-Za-z0-9_-]{1,100}$/.test(code) ? code : "EMAIL_SEND_FAILED";
}

// Telegram API errors carry only the method and status, e.g. "Telegram sendMessage failed: HTTP 403".
function telegramErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const status = /HTTP (\d{3})/.exec(message);
  if (status) return `TELEGRAM_HTTP_${status[1]}`;
  return /network/.test(message) ? "TELEGRAM_NETWORK" : "TELEGRAM_SEND_FAILED";
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getPrisma();
  const run = await db.jobExecution.create({ data: { jobName: "subscription-reminders" } });
  const emailConfig = readReminderMailConfig();
  const emailErrors: string[] = [];
  let emailsSent = 0;
  let telegramSent = 0;
  let created = 0;

  try {
    const today = appDateString();
    const dueDates = [1, 3, 7].map((offset) => addDays(today, offset));
    const subscriptions = await db.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextDueDate: { in: dueDates.map(utcDate) },
      },
      select: { id: true, nextDueDate: true },
    });

    const reminderRows = subscriptions.flatMap((subscription) => {
      const dueDate = dateOnly(subscription.nextDueDate);
      return dueReminderOffsets(today, dueDate).map((daysBefore) => ({
        subscriptionId: subscription.id,
        dueDate: utcDate(dueDate),
        daysBefore,
      }));
    });
    const result = reminderRows.length
      ? await db.reminder.createMany({ data: reminderRows, skipDuplicates: true })
      : { count: 0 };
    created = result.count;

    const currentUnqueued = await db.reminder.findMany({
      where: {
        emailStatus: ReminderEmailStatus.NOT_QUEUED,
        dueDate: { in: dueDates.map(utcDate) },
        daysBefore: { in: [1, 3, 7] },
        subscription: { is: { status: SubscriptionStatus.ACTIVE } },
      },
      include: { subscription: true },
    });
    const eligible = currentUnqueued.filter((reminder) => reminderEmailEligible({
      emailStatus: reminder.emailStatus,
      subscriptionStatus: reminder.subscription.status,
      dueDate: dateOnly(reminder.dueDate),
      currentDueDate: dateOnly(reminder.subscription.nextDueDate),
      today,
      daysBefore: reminder.daysBefore,
    }));

    if (emailConfig) {
      await Promise.all(eligible.map((reminder) => db.reminder.updateMany({
        where: { id: reminder.id, emailStatus: ReminderEmailStatus.NOT_QUEUED },
        data: { emailStatus: ReminderEmailStatus.PENDING },
      })));
    } else if (eligible.length > 0) {
      emailErrors.push("SMTP_NOT_CONFIGURED");
    }

    const pending = await db.reminder.findMany({
      where: { emailStatus: ReminderEmailStatus.PENDING },
      include: { subscription: true },
      orderBy: [{ dueDate: "asc" }, { daysBefore: "desc" }],
    });

    let transport: ReturnType<typeof createReminderTransport> | null = null;
    if (emailConfig && pending.length > 0) transport = createReminderTransport(emailConfig);
    for (const reminder of pending) {
      const dueDate = dateOnly(reminder.dueDate);
      const stillCurrent = reminderEmailEligible({
        emailStatus: reminder.emailStatus,
        subscriptionStatus: reminder.subscription.status,
        dueDate,
        currentDueDate: dateOnly(reminder.subscription.nextDueDate),
        today,
        daysBefore: reminder.daysBefore,
      });
      if (!stillCurrent) {
        await db.reminder.updateMany({
          where: { id: reminder.id, emailStatus: ReminderEmailStatus.PENDING },
          data: { emailStatus: ReminderEmailStatus.SKIPPED },
        });
        continue;
      }
      if (!emailConfig || !transport) {
        emailErrors.push("SMTP_NOT_CONFIGURED");
        continue;
      }

      const claim = await db.reminder.updateMany({
        where: { id: reminder.id, emailStatus: ReminderEmailStatus.PENDING },
        data: { emailStatus: ReminderEmailStatus.SENDING, emailAttemptedAt: new Date() },
      });
      if (claim.count === 0) continue;

      try {
        const messageId = await sendReminderEmail({
          name: reminder.subscription.name,
          amount: Number(reminder.subscription.price),
          currency: reminder.subscription.currency,
          dueDate,
          intervalCount: reminder.subscription.intervalCount,
          intervalUnit: reminder.subscription.intervalUnit,
          paymentMethod: reminder.subscription.paymentMethod,
          daysBefore: reminder.daysBefore,
        }, emailConfig, transport);
        await db.reminder.update({
          where: { id: reminder.id },
          data: {
            emailStatus: ReminderEmailStatus.SENT,
            emailSentAt: new Date(),
            emailMessageId: messageId,
            emailErrorCode: null,
          },
        });
        emailsSent += 1;
      } catch (error) {
        const code = emailErrorCode(error);
        await db.reminder.update({
          where: { id: reminder.id },
          data: { emailStatus: ReminderEmailStatus.ERROR, emailErrorCode: code },
        });
        emailErrors.push(code);
      }
    }

    const telegram = readTelegramConfig(process.env);
    const telegramChatId = telegram.token && telegram.allowedChatId ? Number(telegram.allowedChatId) : Number.NaN;
    if (Number.isSafeInteger(telegramChatId)) {
      const unsent = await db.reminder.findMany({
        where: {
          telegramAttemptedAt: null,
          dueDate: { in: dueDates.map(utcDate) },
          daysBefore: { in: [1, 3, 7] },
          subscription: { is: { status: SubscriptionStatus.ACTIVE } },
        },
        include: { subscription: true },
        orderBy: [{ dueDate: "asc" }, { daysBefore: "desc" }],
      });
      for (const reminder of unsent) {
        const dueDate = dateOnly(reminder.dueDate);
        const current = reminderSendable({
          subscriptionStatus: reminder.subscription.status,
          dueDate,
          currentDueDate: dateOnly(reminder.subscription.nextDueDate),
          today,
          daysBefore: reminder.daysBefore,
        });
        if (!current) continue;

        // Claim before sending, so an overlapping run cannot send the same reminder twice.
        const claim = await db.reminder.updateMany({
          where: { id: reminder.id, telegramAttemptedAt: null },
          data: { telegramAttemptedAt: new Date() },
        });
        if (claim.count === 0) continue;

        const subscription = reminder.subscription;
        try {
          await sendMessage(
            telegramChatId,
            buildReminderText({
              subscriptionId: subscription.id,
              name: subscription.name,
              amount: Number(subscription.price),
              currency: subscription.currency,
              dueDate,
              chargeTime: subscription.chargeTime,
              intervalCount: subscription.intervalCount,
              intervalUnit: subscription.intervalUnit,
              paymentMethod: subscription.paymentMethod,
              daysBefore: reminder.daysBefore,
            }),
            buildPaidKeyboard(subscription.id, dueDate),
          );
          await db.reminder.update({
            where: { id: reminder.id },
            data: { telegramSentAt: new Date(), telegramErrorCode: null },
          });
          telegramSent += 1;
        } catch (error) {
          const code = telegramErrorCode(error);
          await db.reminder.update({ where: { id: reminder.id }, data: { telegramErrorCode: code } });
          emailErrors.push(code);
        }
      }
    }

    const staleSending = await db.reminder.updateMany({
      where: {
        emailStatus: ReminderEmailStatus.SENDING,
        emailAttemptedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      data: { emailStatus: ReminderEmailStatus.ERROR, emailErrorCode: "DELIVERY_OUTCOME_UNKNOWN" },
    });
    if (staleSending.count > 0) emailErrors.push("DELIVERY_OUTCOME_UNKNOWN");

    const errorSummary = [...new Set(emailErrors)].join(", ") || null;
    await db.jobExecution.update({
      where: { id: run.id },
      data: {
        status: errorSummary ? JobStatus.ERROR : JobStatus.SUCCESS,
        finishedAt: new Date(),
        createdCount: created,
        errorMessage: errorSummary,
      },
    });
    return Response.json({ created, checked: subscriptions.length, emailsSent, telegramSent, errors: emailErrors.length }, {
      status: errorSummary ? 500 : 200,
    });
  } catch (error) {
    await db.jobExecution.update({
      where: { id: run.id },
      data: { status: JobStatus.ERROR, finishedAt: new Date(), createdCount: created, errorMessage: redactError(error) },
    });
    return Response.json({ error: "Reminder generation failed. See activity log." }, { status: 500 });
  }
}
