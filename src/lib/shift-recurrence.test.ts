import { describe, expect, it } from "vitest";
import {
  MAX_RECURRENCE_DAYS,
  expandShiftDates,
  isCalendarDate,
  planShiftDates,
} from "@/lib/shift-recurrence";

describe("expandShiftDates", () => {
  it("expands Monday to Friday across a month boundary", () => {
    expect(
      expandShiftDates({ startDate: "2026-11-27", endDate: "2026-12-02", weekdays: [1, 2, 3, 4, 5] }),
    ).toEqual(["2026-11-27", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  it("expands a single weekday", () => {
    expect(
      expandShiftDates({ startDate: "2026-11-01", endDate: "2026-11-22", weekdays: [0] }),
    ).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22"]);
  });

  it("includes both ends when start and end are the same day", () => {
    expect(
      expandShiftDates({ startDate: "2026-11-09", endDate: "2026-11-09", weekdays: [1] }),
    ).toEqual(["2026-11-09"]);
  });

  it("handles a leap-year February", () => {
    expect(
      expandShiftDates({ startDate: "2028-02-28", endDate: "2028-03-01", weekdays: [0, 1, 2, 3, 4, 5, 6] }),
    ).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  it("does not duplicate dates for duplicate weekdays", () => {
    expect(
      expandShiftDates({ startDate: "2026-11-09", endDate: "2026-11-09", weekdays: [1, 1] }),
    ).toEqual(["2026-11-09"]);
  });

  it("returns nothing when no date matches", () => {
    expect(expandShiftDates({ startDate: "2026-11-09", endDate: "2026-11-09", weekdays: [2] })).toEqual([]);
  });
});

describe("isCalendarDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-2-3")).toBe(false);
  });
});

describe("planShiftDates", () => {
  it("creates one shift when only a start date is given", () => {
    expect(planShiftDates({ startDate: "2026-11-09", endDate: "", weekdays: [] })).toEqual({
      dates: ["2026-11-09"],
      error: null,
    });
  });

  it("requires a start date", () => {
    expect(planShiftDates({ startDate: "", endDate: "", weekdays: [] }).error).toMatch(/วันที่เริ่ม/);
  });

  it("requires an end date when weekdays are selected", () => {
    expect(planShiftDates({ startDate: "2026-11-09", endDate: "", weekdays: [1] }).error).toMatch(/วันที่สิ้นสุด/);
  });

  it("requires weekdays when an end date is given", () => {
    expect(planShiftDates({ startDate: "2026-11-09", endDate: "2026-11-20", weekdays: [] }).error).toMatch(/อย่างน้อย 1 วัน/);
  });

  it("rejects an end date before the start date", () => {
    expect(planShiftDates({ startDate: "2026-11-09", endDate: "2026-11-08", weekdays: [1] }).error).toMatch(/ไม่อยู่ก่อน/);
  });

  it("rejects impossible dates", () => {
    expect(planShiftDates({ startDate: "2026-02-30", endDate: "", weekdays: [] }).error).toMatch(/ปฏิทินจริง/);
    expect(planShiftDates({ startDate: "2026-02-01", endDate: "2026-02-30", weekdays: [1] }).error).toMatch(/ปฏิทินจริง/);
  });

  it("allows exactly the maximum range and rejects one day more", () => {
    const atLimit = planShiftDates({ startDate: "2026-01-01", endDate: "2027-01-01", weekdays: [1] });
    expect(atLimit.error).toBeNull();
    const overLimit = planShiftDates({ startDate: "2026-01-01", endDate: "2027-01-02", weekdays: [1] });
    expect(overLimit.error).toMatch(String(MAX_RECURRENCE_DAYS));
  });

  it("rejects a range where no selected weekday occurs", () => {
    expect(planShiftDates({ startDate: "2026-11-09", endDate: "2026-11-09", weekdays: [2] }).error).toMatch(/ไม่มีกะ/);
  });
});
