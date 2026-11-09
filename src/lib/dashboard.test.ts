import { describe, expect, it } from "vitest";
import { categoryEmoji, monthKeys, relativeDayLabel, shiftTone, spendByCategory, weekDates } from "./dashboard";

describe("spendByCategory", () => {
  it("groups, labels and sorts by amount", () => {
    const result = spendByCategory([
      { category: "food", amount: 60 },
      { category: "transport", amount: 40 },
      { category: "food", amount: 100 },
      { category: "Other", amount: 0 },
    ]);
    expect(result.map((item) => item.label)).toEqual(["อาหาร", "เดินทาง", "อื่นๆ"]);
    expect(result[0].amount).toBe(160);
    expect(result[0].share).toBeCloseTo(0.8);
  });

  it("keeps free-text categories as typed and handles an empty month", () => {
    expect(spendByCategory([{ category: "Netflix", amount: 10 }])[0].label).toBe("Netflix");
    expect(spendByCategory([])).toEqual([]);
  });
});

describe("weekDates", () => {
  it("starts on Monday", () => {
    // 2026-11-08 is a Sunday.
    expect(weekDates("2026-11-08")).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
    expect(weekDates("2026-11-09")[0]).toBe("2026-11-09");
  });
});

describe("shiftTone", () => {
  it("groups by start hour", () => {
    expect(shiftTone("09:00")).toBe("day");
    expect(shiftTone("13:00")).toBe("afternoon");
    expect(shiftTone("22:00")).toBe("night");
  });
});

describe("monthKeys", () => {
  it("counts back across a year boundary", () => {
    expect(monthKeys("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("relativeDayLabel and categoryEmoji", () => {
  it("labels today and yesterday only", () => {
    expect(relativeDayLabel("2026-11-08", "2026-11-08")).toBe("วันนี้");
    expect(relativeDayLabel("2026-11-07", "2026-11-08")).toBe("เมื่อวาน");
    expect(relativeDayLabel("2026-11-01", "2026-11-08")).toBeNull();
    expect(categoryEmoji("food")).toBe("🍔");
    expect(categoryEmoji("Netflix")).toBe("📦");
  });
});
