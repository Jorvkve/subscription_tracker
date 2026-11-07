import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  EXPENSE_CATEGORIES,
} from "@/lib/expense-categories";

describe("expense-categories", () => {
  it("contains the expected categories in order", () => {
    expect(EXPENSE_CATEGORIES).toEqual([
      { key: "food", label: "อาหาร" },
      { key: "transport", label: "เดินทาง" },
      { key: "shopping", label: "ช้อปปิ้ง" },
      { key: "bills", label: "บิลและค่าบริการ" },
      { key: "fun", label: "บันเทิง" },
      { key: "health", label: "สุขภาพ" },
      { key: "other", label: "อื่นๆ" },
    ]);
  });

  it("categoryLabel returns the Thai label for valid keys", () => {
    expect(categoryLabel("food")).toBe("อาหาร");
    expect(categoryLabel("transport")).toBe("เดินทาง");
    expect(categoryLabel("shopping")).toBe("ช้อปปิ้ง");
    expect(categoryLabel("bills")).toBe("บิลและค่าบริการ");
    expect(categoryLabel("fun")).toBe("บันเทิง");
    expect(categoryLabel("health")).toBe("สุขภาพ");
    expect(categoryLabel("other")).toBe("อื่นๆ");
  });

  it("categoryLabel returns null for unknown keys", () => {
    expect(categoryLabel("")).toBeNull();
    expect(categoryLabel("unknown")).toBeNull();
    expect(categoryLabel("FOOD")).toBeNull();
    expect(categoryLabel("อาหาร")).toBeNull();
  });
});
