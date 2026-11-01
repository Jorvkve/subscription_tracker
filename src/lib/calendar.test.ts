import { describe, expect, it } from "vitest";
import { buildCalendarEvents, calendarGrid } from "@/lib/calendar";

const monthly = {
  id: "icloud",
  name: "iCloud",
  amount: 39,
  currency: "THB",
  intervalCount: 1,
  intervalUnit: "MONTH" as const,
  billingDay: 2,
  nextDueDate: "2026-11-02",
};

describe("dashboard billing calendar", () => {
  it("builds a six-week grid with every leap-day date exactly once", () => {
    const grid = calendarGrid("2028-02");
    const dates = grid.flat().filter((date): date is string => date !== null);
    expect(grid).toHaveLength(6);
    expect(dates).toHaveLength(29);
    expect(dates[0]).toBe("2028-02-01");
    expect(dates.at(-1)).toBe("2028-02-29");
  });

  it("shows current due dates, projected future cycles, and settled payment dates", () => {
    const events = buildCalendarEvents({
      month: "2026-11",
      today: "2026-10-01",
      subscriptions: [monthly],
      payments: [{
        id: "payment-1",
        subscriptionId: "icloud",
        subscriptionName: "iCloud",
        amount: 39,
        currency: "THB",
        coveredDueDate: "2026-11-05",
      }],
    });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2026-11-02", kind: "DUE", name: "iCloud" }),
      expect.objectContaining({ date: "2026-11-05", kind: "PAID", name: "iCloud" }),
    ]));
  });

  it("projects later cycles only when the current due date has not become overdue", () => {
    const events = buildCalendarEvents({
      month: "2026-11",
      today: "2026-10-01",
      subscriptions: [{ ...monthly, nextDueDate: "2026-10-20" }],
      payments: [],
    });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2026-11-02", kind: "PROJECTED" }),
    ]));

    const overdue = buildCalendarEvents({
      month: "2026-11",
      today: "2026-11-01",
      subscriptions: [{ ...monthly, nextDueDate: "2026-10-20" }],
      payments: [],
    });
    expect(overdue).toEqual([]);
  });

  it("shows unpaid overdue items on their due month without inventing another cycle", () => {
    const events = buildCalendarEvents({
      month: "2026-10",
      today: "2026-11-01",
      subscriptions: [{ ...monthly, nextDueDate: "2026-10-20" }],
      payments: [],
    });
    expect(events).toEqual([
      expect.objectContaining({ date: "2026-10-20", kind: "OVERDUE" }),
    ]);
  });
});
