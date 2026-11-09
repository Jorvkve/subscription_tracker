import { describe, expect, it } from "vitest";
import { buildDailySummary } from "@/lib/daily-summary";

const base = { date: "2026-11-09", items: [], monthTotal: 0, budgets: [], tomorrowShifts: [], dueTomorrow: [] };

describe("buildDailySummary", () => {
  it("lists the day's items, the month total, budgets, and tomorrow", () => {
    const text = buildDailySummary({
      ...base,
      items: [{ amount: 60, currency: "THB", time: "12:10", title: "ข้าว", category: "อาหาร" }],
      monthTotal: 8513,
      budgets: [{ key: "food", label: "อาหาร", budget: 3000, spent: 2700, share: 0.9, level: "warn" }],
      tomorrowShifts: [{ title: "กะเช้า", startTime: "08:30", endTime: "17:30", location: "CP" }],
      dueTomorrow: [{ name: "iCloud", amount: 99, currency: "THB" }],
    });
    expect(text).toMatch(/^🌙 สรุปประจำวันที่ /);
    expect(text).toContain("12:10 · ข้าว · อาหาร · 60.00 บาท");
    expect(text).toContain("เดือนนี้ใช้ไปแล้ว 8,513.00 บาท");
    expect(text).toContain("🟡 อาหาร 2,700 / 3,000 (90%)");
    expect(text).toContain("💼 กะเช้า 08:30–17:30 · CP");
    expect(text).toContain("💳 ตัดเงิน iCloud 99.00 บาท");
  });

  it("says when nothing was recorded and leaves out empty sections", () => {
    const text = buildDailySummary(base);
    expect(text).toContain("ยังไม่มีรายการ");
    expect(text).not.toContain("งบเดือนนี้");
    expect(text).not.toContain("พรุ่งนี้");
  });
});
