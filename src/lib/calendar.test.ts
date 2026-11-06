import { describe, expect, it } from "vitest";
import { buildCalendarEvents, buildScheduleEvents, calendarGrid } from "@/lib/calendar";

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

  it("copies chargeTime for DUE, OVERDUE, and PROJECTED events", () => {
    const events = buildCalendarEvents({
      month: "2026-11",
      today: "2026-10-01",
      subscriptions: [{ ...monthly, chargeTime: "14:30" }],
      payments: [],
    });
    expect(events[0]?.chargeTime).toBe("14:30");

    const overdueEvents = buildCalendarEvents({
      month: "2026-10",
      today: "2026-11-01",
      subscriptions: [{ ...monthly, nextDueDate: "2026-10-20", chargeTime: "09:00" }],
      payments: [],
    });
    expect(overdueEvents[0]?.chargeTime).toBe("09:00");
  });
});

describe("buildScheduleEvents", () => {
  it("keeps items in the month and filters out DONE tasks and tasks with no due date", () => {
    const events = buildScheduleEvents({
      month: "2026-11",
      tasks: [
        { id: "t1", title: "Open Task", dueDate: "2026-11-10", priority: "MEDIUM", status: "TODO" },
        { id: "t2", title: "Done Task", dueDate: "2026-11-12", priority: "HIGH", status: "DONE" },
        { id: "t3", title: "No Date Task", dueDate: null, priority: "LOW", status: "TODO" },
        { id: "t4", title: "Next Month Task", dueDate: "2026-12-01", priority: "MEDIUM", status: "IN_PROGRESS" },
      ],
      shifts: [
        { id: "s1", title: "Shift Nov", date: "2026-11-10", startTime: "09:00", endTime: "17:00" },
        { id: "s2", title: "Shift Oct", date: "2026-10-31", startTime: "08:00", endTime: "16:00" },
      ],
    });

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.id)).toEqual(["t1", "s1"]);
  });

  it("sorts schedule events by date, then time, then title", () => {
    const events = buildScheduleEvents({
      month: "2026-11",
      tasks: [
        { id: "t2", title: "Task B", dueDate: "2026-11-15", priority: "MEDIUM", status: "TODO" },
        { id: "t1", title: "Task A", dueDate: "2026-11-15", priority: "MEDIUM", status: "TODO" },
        { id: "t0", title: "Early Task", dueDate: "2026-11-05", priority: "LOW", status: "TODO" },
      ],
      shifts: [
        { id: "s2", title: "Afternoon Shift", date: "2026-11-15", startTime: "13:00", endTime: "21:00" },
        { id: "s1", title: "Morning Shift", date: "2026-11-15", startTime: "08:00", endTime: "16:00" },
      ],
    });

    // 2026-11-05: Early Task
    // 2026-11-15: Task A (time ""), Task B (time ""), Morning Shift (08:00), Afternoon Shift (13:00)
    expect(events.map((e) => e.id)).toEqual(["t0", "t1", "t2", "s1", "s2"]);
  });
});
