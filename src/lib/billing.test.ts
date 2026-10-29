import { describe, expect, it } from "vitest";
import {
  advanceDueDate,
  annualEquivalent,
  groupCostTotals,
  monthlyEquivalent,
} from "@/lib/billing";

describe("subscription billing calculations", () => {
  it("normalizes three-month billing to monthly and annual equivalents", () => {
    expect(monthlyEquivalent(145, 3, "MONTH")).toBeCloseTo(145 / 3);
    expect(annualEquivalent(145, 3, "MONTH")).toBeCloseTo(580);
  });

  it("keeps recurring totals separate by currency", () => {
    expect(groupCostTotals([
      { amount: 99, currency: "THB", intervalCount: 1, intervalUnit: "MONTH" },
      { amount: 145, currency: "THB", intervalCount: 3, intervalUnit: "MONTH" },
      { amount: 10, currency: "USD", intervalCount: 1, intervalUnit: "MONTH" },
    ])).toEqual({
      THB: { monthly: expect.closeTo(99 + 145 / 3), annual: expect.closeTo((99 + 145 / 3) * 12) },
      USD: { monthly: 10, annual: 120 },
    });
  });

  it("advances a three-month subscription by one period from the scheduled date", () => {
    expect(advanceDueDate("2026-10-28", 3, "MONTH")).toBe("2027-01-28");
  });

  it("clamps month-end dates instead of rolling into the next month", () => {
    expect(advanceDueDate("2027-01-31", 1, "MONTH")).toBe("2027-02-28");
    expect(advanceDueDate("2027-02-28", 1, "MONTH", 31)).toBe("2027-03-31");
    expect(advanceDueDate("2028-01-31", 1, "MONTH")).toBe("2028-02-29");
  });
});
