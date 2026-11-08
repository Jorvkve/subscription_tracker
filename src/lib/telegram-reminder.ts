// Pure helpers for subscription reminders in Telegram: no Prisma, server-only, or network imports.
import type { BillingUnit } from "@/lib/billing";
import { formatDate } from "@/lib/dates";
import type { InlineKeyboard } from "@/lib/telegram-parse";

export type TelegramReminderInput = {
  subscriptionId: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
  chargeTime: string | null;
  intervalCount: number;
  intervalUnit: BillingUnit;
  paymentMethod: string | null;
  daysBefore: number;
};

const unitLabels: Record<BillingUnit, string> = { DAY: "วัน", WEEK: "สัปดาห์", MONTH: "เดือน", YEAR: "ปี" };

function money(amount: number, currency: string): string {
  const value = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value} ${currency === "THB" ? "บาท" : currency}`;
}

function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildReminderText(input: TelegramReminderInput): string {
  const when = input.daysBefore === 1 ? "พรุ่งนี้" : `อีก ${input.daysBefore} วัน`;
  return [
    `เตือนชำระ ${oneLine(input.name, 100)} ${when}`,
    `ยอด ${money(input.amount, input.currency)}`,
    `ครบกำหนด ${formatDate(input.dueDate)}${input.chargeTime ? ` ${input.chargeTime}` : ""}`,
    `รอบบิล ทุก ${input.intervalCount} ${unitLabels[input.intervalUnit]}`,
    input.paymentMethod ? `วิธีชำระ ${oneLine(input.paymentMethod, 100)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const PAID_PATTERN = /^paid:([a-z0-9]{20,32}):(\d{4})(\d{2})(\d{2})$/;

export function encodePaidCallback(subscriptionId: string, dueDate: string): string {
  return `paid:${subscriptionId}:${dueDate.replace(/-/g, "")}`;
}

export function decodePaidCallback(data: string): { subscriptionId: string; dueDate: string } | null {
  const match = PAID_PATTERN.exec(data);
  if (!match) return null;
  return { subscriptionId: match[1], dueDate: `${match[2]}-${match[3]}-${match[4]}` };
}

export function buildPaidKeyboard(subscriptionId: string, dueDate: string): InlineKeyboard {
  return { inline_keyboard: [[{ text: "จ่ายแล้ว", callback_data: encodePaidCallback(subscriptionId, dueDate) }]] };
}

export function paidConfirmation(result: { name: string; amount: number; currency: string; nextDueDate: string }): string {
  return `บันทึกการจ่าย ${oneLine(result.name, 100)} ${money(result.amount, result.currency)} แล้ว\nรอบถัดไป ${formatDate(result.nextDueDate)}`;
}
