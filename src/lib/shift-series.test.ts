import { describe, expect, it } from "vitest";
import { parseShiftScope, scopeOptions, seriesWhere } from "@/lib/shift-series";

describe("shift scopes", () => {
  const shift = { title: "กะเช้า", startTime: "08:30", endTime: "17:30", location: null, date: new Date("2026-11-12T00:00:00.000Z") };

  it("defaults anything unknown to this shift only", () => {
    expect(parseShiftScope("all")).toBe("all");
    expect(parseShiftScope("following")).toBe("following");
    expect(parseShiftScope("everything")).toBe("this");
    expect(parseShiftScope(null)).toBe("this");
  });

  it("matches by title, times and location, and by date for following", () => {
    expect(seriesWhere(shift, "all")).toEqual({ title: "กะเช้า", startTime: "08:30", endTime: "17:30", location: null });
    expect(seriesWhere(shift, "following")).toEqual({
      title: "กะเช้า",
      startTime: "08:30",
      endTime: "17:30",
      location: null,
      date: { gte: shift.date },
    });
  });

  it("offers only the choices that differ", () => {
    expect(scopeOptions({ following: 1, all: 1 }).map((option) => option.value)).toEqual(["this"]);
    expect(scopeOptions({ following: 5, all: 20 }).map((option) => option.value)).toEqual(["this", "following", "all"]);
    // The first shift of a series: "following" would be the same as "all".
    expect(scopeOptions({ following: 20, all: 20 }).map((option) => option.value)).toEqual(["this", "all"]);
    expect(scopeOptions({ following: 1, all: 20 }).map((option) => option.value)).toEqual(["this", "all"]);
    expect(scopeOptions({ following: 5, all: 20 })[1].label).toContain("5 กะ");
  });
});
