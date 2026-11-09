// Pure formatter for the nightly Telegram summary: no Prisma, server-only, or network imports.
import { formatBudgetLines, type BudgetLine } from "@/lib/budget";
import { formatDate } from "@/lib/dates";
import { formatBaht, formatDaySummary, type DayItem } from "@/lib/telegram-parse";

export type SummaryShift = { title: string; startTime: string; endTime: string; location: string | null };
export type SummaryDue = { name: string; amount: number; currency: string };

export type DailySummaryInput = {
  date: string;
  items: readonly DayItem[];
  /** THB spent so far this month, including today. */
  monthTotal: number;
  budgets: readonly BudgetLine[];
  tomorrowShifts: readonly SummaryShift[];
  dueTomorrow: readonly SummaryDue[];
};

function currency(code: string): string {
  return code === "THB" ? "บาท" : code;
}

export function buildDailySummary(input: DailySummaryInput): string {
  const lines = [`🌙 สรุปประจำวันที่ ${formatDate(input.date)}`, "", formatDaySummary(input.date, input.items)];
  lines.push("", `เดือนนี้ใช้ไปแล้ว ${formatBaht(input.monthTotal)} บาท`);

  const budgets = formatBudgetLines(input.budgets);
  if (budgets.length) lines.push(...budgets);

  if (input.tomorrowShifts.length || input.dueTomorrow.length) {
    lines.push("", "พรุ่งนี้");
    for (const shift of input.tomorrowShifts) {
      lines.push(`💼 ${shift.title} ${shift.startTime}–${shift.endTime}${shift.location ? ` · ${shift.location}` : ""}`);
    }
    for (const due of input.dueTomorrow) {
      lines.push(`💳 ตัดเงิน ${due.name} ${formatBaht(due.amount)} ${currency(due.currency)}`);
    }
  }
  return lines.join("\n");
}
