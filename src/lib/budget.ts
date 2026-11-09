// Pure budget helpers: no Prisma, server-only, or network imports.
import { EXPENSE_CATEGORIES, categoryKeyFor, type ExpenseCategoryKey } from "@/lib/expense-categories";

export type BudgetMap = Partial<Record<ExpenseCategoryKey, number>>;
export type SpendMap = Partial<Record<ExpenseCategoryKey, number>>;
export type BudgetLevel = "ok" | "warn" | "over";

/** Share of a budget at which the owner is warned. */
export const BUDGET_WARN_SHARE = 0.8;
const MAX_BUDGET = 100_000_000;

/** The budget category of a stored expense category; see `categoryKeyFor`. */
export function categoryKeyOf(value: string): ExpenseCategoryKey {
  return categoryKeyFor(value);
}

export function sumByCategory(rows: readonly { category: string; amount: number }[]): SpendMap {
  const sums: SpendMap = {};
  for (const row of rows) {
    const key = categoryKeyOf(row.category);
    sums[key] = (sums[key] ?? 0) + row.amount;
  }
  return sums;
}

export function budgetLevel(spent: number, budget: number): BudgetLevel {
  if (spent > budget) return "over";
  return spent >= budget * BUDGET_WARN_SHARE ? "warn" : "ok";
}

export type BudgetLine = {
  key: ExpenseCategoryKey;
  label: string;
  budget: number;
  spent: number;
  share: number;
  level: BudgetLevel;
};

/** One line per category that has a budget, in the app's category order. */
export function budgetLines(budgets: BudgetMap, spent: SpendMap): BudgetLine[] {
  return EXPENSE_CATEGORIES.flatMap((category) => {
    const budget = budgets[category.key];
    if (!budget) return [];
    const used = spent[category.key] ?? 0;
    return [{ key: category.key, label: category.label, budget, spent: used, share: used / budget, level: budgetLevel(used, budget) }];
  });
}

/**
 * The level an expense pushed its category into, when it crossed 80% or 100% of the budget.
 * Only a crossing counts, so each threshold is announced once a month per category.
 */
export function crossedBudget(before: number, after: number, budget: number): Exclude<BudgetLevel, "ok"> | null {
  if (budget <= 0 || after <= before) return null;
  if (before <= budget && after > budget) return "over";
  const warnAt = budget * BUDGET_WARN_SHARE;
  if (before < warnAt && after >= warnAt) return "warn";
  return null;
}

function baht(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function budgetAlertText(label: string, spent: number, budget: number, level: "warn" | "over"): string {
  const percent = Math.round((spent / budget) * 100);
  if (Math.round(spent * 100) === Math.round(budget * 100)) {
    return `✅ ${label}ครบงบพอดี ${baht(spent)} บาท`;
  }
  if (level === "over") {
    return `⚠️ เกินงบ${label}แล้ว ใช้ไป ${baht(spent)} จากงบ ${baht(budget)} บาท (${percent}%)`;
  }
  return `🔔 งบ${label}ใช้ไป ${percent}% แล้ว (${baht(spent)} / ${baht(budget)} บาท) เหลือ ${baht(budget - spent)} บาท`;
}

/** Budget lines for Telegram summaries, or an empty list when no budget is set. */
export function formatBudgetLines(lines: readonly BudgetLine[]): string[] {
  if (lines.length === 0) return [];
  const icon: Record<BudgetLevel, string> = { ok: "🟢", warn: "🟡", over: "🔴" };
  return [
    "งบเดือนนี้",
    ...lines.map((line) => `${icon[line.level]} ${line.label} ${baht(line.spent)} / ${baht(line.budget)} (${Math.round(line.share * 100)}%)`),
  ];
}

/** Reads `budget_<key>` fields; an empty field removes that category's budget. */
export function parseBudgetForm(formData: FormData): Record<ExpenseCategoryKey, number | null> {
  const result = {} as Record<ExpenseCategoryKey, number | null>;
  for (const category of EXPENSE_CATEGORIES) {
    const raw = String(formData.get(`budget_${category.key}`) ?? "").replace(/[,\s฿]/g, "");
    if (raw === "") {
      result[category.key] = null;
      continue;
    }
    const amount = Number(raw);
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || !Number.isFinite(amount) || amount < 0 || amount > MAX_BUDGET) {
      throw new Error(`งบ${category.label}ไม่ถูกต้อง ใส่ตัวเลขไม่เกิน 2 ตำแหน่งทศนิยม`);
    }
    result[category.key] = amount > 0 ? amount : null;
  }
  return result;
}
