import { describe, expect, it } from "vitest";
import {
  formatDuration,
  parseTimeOfDay,
  shiftDurationMinutes,
} from "@/lib/time-of-day";

describe("parseTimeOfDay", () => {
  it("accepts valid 24-hour HH:mm formats", () => {
    expect(parseTimeOfDay("00:00")).toBe("00:00");
    expect(parseTimeOfDay("08:30")).toBe("08:30");
    expect(parseTimeOfDay("13:45")).toBe("13:45");
    expect(parseTimeOfDay("23:59")).toBe("23:59");
    expect(parseTimeOfDay("  09:15  ")).toBe("09:15");
  });

  it("rejects invalid hours, minutes, and malformed strings", () => {
    expect(() => parseTimeOfDay("24:00")).toThrow();
    expect(() => parseTimeOfDay("12:60")).toThrow();
    expect(() => parseTimeOfDay("9:30")).toThrow();
    expect(() => parseTimeOfDay("09:3")).toThrow();
    expect(() => parseTimeOfDay("abc")).toThrow();
    expect(() => parseTimeOfDay("")).toThrow();
    expect(() => parseTimeOfDay(null)).toThrow();
    expect(() => parseTimeOfDay(1234)).toThrow();
    expect(() => parseTimeOfDay("25:10")).toThrow();
  });
});

describe("shiftDurationMinutes", () => {
  it("calculates same-day shift durations", () => {
    expect(shiftDurationMinutes("09:00", "17:00")).toBe(480);
    expect(shiftDurationMinutes("08:30", "12:45")).toBe(255);
    expect(shiftDurationMinutes("00:00", "01:15")).toBe(75);
  });

  it("calculates overnight shift durations", () => {
    expect(shiftDurationMinutes("22:00", "06:00")).toBe(480);
    expect(shiftDurationMinutes("23:30", "00:30")).toBe(60);
    expect(shiftDurationMinutes("21:00", "09:00")).toBe(720);
  });
});

describe("formatDuration", () => {
  it("formats zero minutes correctly", () => {
    expect(formatDuration(0)).toBe("0 นาที");
  });

  it("formats minutes only when less than 60 minutes", () => {
    expect(formatDuration(15)).toBe("15 นาที");
    expect(formatDuration(45)).toBe("45 นาที");
    expect(formatDuration(59)).toBe("59 นาที");
  });

  it("formats exact hours with no remaining minutes", () => {
    expect(formatDuration(60)).toBe("1 ชม.");
    expect(formatDuration(120)).toBe("2 ชม.");
    expect(formatDuration(480)).toBe("8 ชม.");
    expect(formatDuration(720)).toBe("12 ชม.");
  });

  it("formats both hours and remaining minutes", () => {
    expect(formatDuration(75)).toBe("1 ชม. 15 นาที");
    expect(formatDuration(255)).toBe("4 ชม. 15 นาที");
    expect(formatDuration(510)).toBe("8 ชม. 30 นาที");
  });
});
