import { describe, expect, it } from "vitest";
import { dueReminderOffsets, reminderMatchesDueDate } from "@/lib/reminders";

describe("in-app reminder schedule", () => {
  it("matches only the configured 7, 3, and 1 day offsets", () => {
    expect(dueReminderOffsets("2026-11-01", "2026-11-08")).toEqual([7]);
    expect(dueReminderOffsets("2026-11-01", "2026-11-04")).toEqual([3]);
    expect(dueReminderOffsets("2026-11-01", "2026-11-02")).toEqual([1]);
    expect(dueReminderOffsets("2026-11-01", "2026-11-01")).toEqual([]);
  });

  it("does not create pre-due reminders for overdue dates", () => {
    expect(dueReminderOffsets("2026-11-01", "2026-10-31")).toEqual([]);
  });

  it("does not treat an old due-date reminder as current after the schedule moves", () => {
    expect(reminderMatchesDueDate("2026-11-08", "2026-11-08")).toBe(true);
    expect(reminderMatchesDueDate("2026-11-08", "2027-02-08")).toBe(false);
  });
});

describe("email reminder eligibility", () => {
  it("allows only an active current due-date reminder at its configured offset", async () => {
    const { reminderEmailEligible } = await import("@/lib/reminders");
    expect(reminderEmailEligible({
      emailStatus: "NOT_QUEUED",
      subscriptionStatus: "ACTIVE",
      dueDate: "2026-11-08",
      currentDueDate: "2026-11-08",
      today: "2026-11-01",
      daysBefore: 7,
    })).toBe(true);
    expect(reminderEmailEligible({
      emailStatus: "PENDING",
      subscriptionStatus: "ACTIVE",
      dueDate: "2026-11-04",
      currentDueDate: "2026-11-04",
      today: "2026-11-01",
      daysBefore: 3,
    })).toBe(true);
  });

  it("rejects stale, inactive, sent, or off-schedule reminders", async () => {
    const { reminderEmailEligible } = await import("@/lib/reminders");
    const base = {
      emailStatus: "PENDING",
      subscriptionStatus: "ACTIVE",
      dueDate: "2026-11-08",
      currentDueDate: "2026-11-08",
      today: "2026-11-01",
      daysBefore: 7,
    } as const;
    expect(reminderEmailEligible({ ...base, currentDueDate: "2027-02-08" })).toBe(false);
    expect(reminderEmailEligible({ ...base, today: "2026-11-09" })).toBe(false);
    expect(reminderEmailEligible({ ...base, subscriptionStatus: "PAUSED" })).toBe(false);
    expect(reminderEmailEligible({ ...base, emailStatus: "SENT" })).toBe(false);
    expect(reminderEmailEligible({ ...base, daysBefore: 6 })).toBe(false);
  });
});
