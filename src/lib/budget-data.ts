import "server-only";
import { budgetAlertText, budgetLines, categoryKeyOf, crossedBudget, sumByCategory, type BudgetLine, type BudgetMap, type SpendMap } from "@/lib/budget";
import { utcDate } from "@/lib/dates";
import { EXPENSE_CATEGORIES, type ExpenseCategoryKey } from "@/lib/expense-categories";
import { getPrisma } from "@/lib/prisma";

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { gte: utcDate(`${month}-01`), lte: utcDate(`${month}-${String(last).padStart(2, "0")}`) };
}

export async function loadBudgets(): Promise<BudgetMap> {
  const rows = await getPrisma().categoryBudget.findMany();
  const budgets: BudgetMap = {};
  for (const row of rows) {
    if (EXPENSE_CATEGORIES.some((item) => item.key === row.category)) {
      budgets[row.category as ExpenseCategoryKey] = Number(row.amount);
    }
  }
  return budgets;
}

/** THB spending per category in a YYYY-MM month. Budgets are in baht only. */
export async function monthSpend(month: string): Promise<SpendMap> {
  const rows = await getPrisma().expenseSlip.findMany({
    where: { currency: "THB", paidDate: monthRange(month) },
    select: { category: true, amount: true },
  });
  return sumByCategory(rows.map((row) => ({ category: row.category, amount: Number(row.amount) })));
}

export async function monthBudgetLines(month: string): Promise<BudgetLine[]> {
  const [budgets, spent] = await Promise.all([loadBudgets(), monthSpend(month)]);
  return budgetLines(budgets, spent);
}

/**
 * Call after an expense was saved or moved into `category`: returns a warning when that
 * amount pushed the category's month past 80% or 100% of its budget.
 */
export async function budgetAlertAfter(category: string, paidDate: string, amount: number, currency = "THB"): Promise<string | null> {
  if (currency !== "THB") return null;
  const key = categoryKeyOf(category);
  const budgets = await loadBudgets();
  const budget = budgets[key];
  if (!budget) return null;
  const spent = (await monthSpend(paidDate.slice(0, 7)))[key] ?? 0;
  const level = crossedBudget(spent - amount, spent, budget);
  const label = EXPENSE_CATEGORIES.find((item) => item.key === key)?.label ?? key;
  return level ? budgetAlertText(label, spent, budget, level) : null;
}
