import { describe, expect, it } from "vitest";
import { EXPENSE_CATEGORIES, categoryKeyFor, categoryLabel, matchCategoryKey } from "@/lib/expense-categories";

describe("expense-categories", () => {
  it("follows the owner's budget items, with อื่นๆ last", () => {
    expect(EXPENSE_CATEGORIES.map((item) => item.label)).toEqual([
      "ค่ากิน",
      "ค่าห้อง",
      "ค่าน้ำมัน",
      "ค่าเน็ต",
      "ค่าซักผ้า",
      "เงินเก็บ",
      "ค่าน้ำค่าไฟ",
      "หุ้น",
      "ฉุกเฉิน",
      "จ่ายบิล",
      "บิลรายเดือน",
      "อื่นๆ",
    ]);
    expect(new Set(EXPENSE_CATEGORIES.map((item) => item.key)).size).toBe(EXPENSE_CATEGORIES.length);
  });

  it("categoryLabel returns the Thai label for keys only", () => {
    expect(categoryLabel("food")).toBe("ค่ากิน");
    expect(categoryLabel("subs")).toBe("บิลรายเดือน");
    expect(categoryLabel("other")).toBe("อื่นๆ");
    expect(categoryLabel("ค่ากิน")).toBeNull();
    expect(categoryLabel("transport")).toBeNull();
  });

  it("maps keys, labels and old names, and leaves free text unmatched", () => {
    expect(matchCategoryKey("ค่าห้อง")).toBe("rent");
    expect(matchCategoryKey("FOOD")).toBe("food");
    expect(matchCategoryKey("อาหาร")).toBe("food");
    expect(matchCategoryKey("เดินทาง")).toBe("fuel");
    expect(matchCategoryKey("บิลและค่าบริการ")).toBe("bills");
    expect(matchCategoryKey("บันเทิง")).toBe("other");
    expect(matchCategoryKey("Netflix")).toBeNull();
    expect(categoryKeyFor("Netflix")).toBe("other");
  });
});
