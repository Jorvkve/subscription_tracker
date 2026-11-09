import { describe, expect, it } from "vitest";
import {
  budgetAlertText,
  budgetLevel,
  budgetLines,
  categoryKeyOf,
  crossedBudget,
  formatBudgetLines,
  parseBudgetForm,
  sumByCategory,
} from "@/lib/budget";

describe("categoryKeyOf", () => {
  it("reads web keys, bot labels, and anything else as other", () => {
    expect(categoryKeyOf("food")).toBe("food");
    expect(categoryKeyOf("ค่ากิน")).toBe("food");
    expect(categoryKeyOf("อาหาร")).toBe("food");
    expect(categoryKeyOf("จ่ายบิล")).toBe("bills");
    expect(categoryKeyOf("Other")).toBe("other");
    expect(categoryKeyOf("Cloud")).toBe("other");
  });

  it("adds keys and labels of one category together", () => {
    expect(sumByCategory([
      { category: "food", amount: 50 },
      { category: "อาหาร", amount: 60 },
      { category: "ค่าน้ำมัน", amount: 30 },
    ])).toEqual({ food: 110, fuel: 30 });
  });
});

describe("budget levels", () => {
  it("warns at 80% and flags anything above the budget", () => {
    expect(budgetLevel(799, 1000)).toBe("ok");
    expect(budgetLevel(800, 1000)).toBe("warn");
    expect(budgetLevel(1000, 1000)).toBe("warn");
    expect(budgetLevel(1000.01, 1000)).toBe("over");
  });

  it("reports only the threshold an expense crossed", () => {
    expect(crossedBudget(700, 850, 1000)).toBe("warn");
    expect(crossedBudget(850, 900, 1000)).toBeNull();
    expect(crossedBudget(900, 1100, 1000)).toBe("over");
    expect(crossedBudget(500, 1200, 1000)).toBe("over");
    expect(crossedBudget(1100, 1200, 1000)).toBeNull();
    expect(crossedBudget(900, 800, 1000)).toBeNull();
  });

  it("lists only budgeted categories in app order", () => {
    const lines = budgetLines({ rent: 1000, food: 3000 }, { food: 2700, rent: 100, laundry: 50 });
    expect(lines.map((line) => [line.key, line.level])).toEqual([["food", "warn"], ["rent", "ok"]]);
    expect(formatBudgetLines(lines)).toEqual(["งบเดือนนี้", "🟡 ค่ากิน 2,700 / 3,000 (90%)", "🟢 ค่าห้อง 100 / 1,000 (10%)"]);
    expect(formatBudgetLines([])).toEqual([]);
  });

  it("words warnings in Thai", () => {
    expect(budgetAlertText("อาหาร", 2500, 3000, "warn")).toContain("ใช้ไป 83%");
    expect(budgetAlertText("อาหาร", 3200, 3000, "over")).toContain("เกินงบอาหารแล้ว");
    expect(budgetAlertText("ค่าห้อง", 5500, 5500, "warn")).toBe("✅ ค่าห้องครบงบพอดี 5,500 บาท");
  });
});

describe("parseBudgetForm", () => {
  function form(fields: Record<string, string>) {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
  }

  it("reads amounts and treats empty or zero as no budget", () => {
    const parsed = parseBudgetForm(form({ budget_food: "3,000", budget_rent: "", budget_stocks: "0" }));
    expect(parsed.food).toBe(3000);
    expect(parsed.rent).toBeNull();
    expect(parsed.stocks).toBeNull();
    expect(parsed.other).toBeNull();
  });

  it("rejects text and negative numbers", () => {
    expect(() => parseBudgetForm(form({ budget_food: "abc" }))).toThrow("งบค่ากิน");
    expect(() => parseBudgetForm(form({ budget_food: "-5" }))).toThrow();
  });
});
