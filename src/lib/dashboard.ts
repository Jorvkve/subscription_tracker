import { addDays } from "@/lib/dates";
import { EXPENSE_CATEGORIES, categoryLabel, matchCategoryKey } from "@/lib/expense-categories";

export type CategorySpend = { key: string; label: string; amount: number; share: number };

/** Sums expenses by category, largest first, with each share of the total (0..1). */
export function spendByCategory(expenses: readonly { category: string; amount: number }[]): CategorySpend[] {
  const sums = new Map<string, number>();
  for (const { category, amount } of expenses) {
    // Known keys, labels and old names group under one category; free text stays as typed.
    const key = matchCategoryKey(category) ?? (category.trim() || "other");
    sums.set(key, (sums.get(key) ?? 0) + amount);
  }
  const total = [...sums.values()].reduce((sum, value) => sum + value, 0);
  return [...sums.entries()]
    .map(([key, amount]) => ({
      key,
      label: categoryLabel(key) ?? key,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** The seven dates (Monday first) of the week that contains `today`. */
export function weekDates(today: string): string[] {
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export type ShiftTone = "day" | "afternoon" | "night";

/** Colour group for a shift pill, from its start time (HH:mm). */
export function shiftTone(startTime: string): ShiftTone {
  const hour = Number(startTime.slice(0, 2));
  if (hour < 12) return "day";
  if (hour < 17) return "afternoon";
  return "night";
}

/** Emoji for a category key, label, or old name; free-text categories get a box. */
export function categoryEmoji(category: string): string {
  const key = matchCategoryKey(category);
  return EXPENSE_CATEGORIES.find((item) => item.key === key)?.emoji ?? "📦";
}

/** The `count` months (YYYY-MM) ending with `lastMonth`, oldest first. */
export function monthKeys(lastMonth: string, count: number): string[] {
  const [year, month] = lastMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(Date.UTC(year, month - count + index, 1));
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** "วันนี้" / "เมื่อวาน" / null for other dates. */
export function relativeDayLabel(date: string, today: string): string | null {
  if (date === today) return "วันนี้";
  if (date === addDays(today, -1)) return "เมื่อวาน";
  return null;
}
