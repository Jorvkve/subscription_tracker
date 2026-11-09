import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isSlipOcrConfigured, toSlipReading } from "@/lib/slip-ocr";

const today = "2026-11-09";

describe("toSlipReading", () => {
  it("keeps a full reading", () => {
    expect(
      toSlipReading({ isSlip: true, amount: 1250, date: "2026-11-08", time: "9:05", payee: " ร้านกาแฟ " }, today),
    ).toEqual({ amount: 1250, date: "2026-11-08", time: "09:05", payee: "ร้านกาแฟ" });
  });

  it("rounds the amount to satang", () => {
    expect(toSlipReading({ isSlip: true, amount: 12.345, date: null, time: null, payee: null }, today)?.amount).toBe(12.35);
  });

  it("converts a Buddhist year the model left as is", () => {
    expect(toSlipReading({ isSlip: true, amount: 50, date: "2569-11-08", time: null, payee: null }, today)?.date).toBe(
      "2026-11-08",
    );
  });

  it.each([
    ["future", "2026-11-10"],
    ["impossible", "2026-02-30"],
    ["free text", "8 พ.ย. 69"],
  ])("drops a %s date but keeps the amount", (_, date) => {
    expect(toSlipReading({ isSlip: true, amount: 50, date, time: "25:00", payee: "" }, today)).toEqual({
      amount: 50,
      date: null,
      time: null,
      payee: null,
    });
  });

  it.each([
    { isSlip: false, amount: 50 },
    { isSlip: true, amount: null },
    { isSlip: true, amount: 0 },
    { isSlip: true, amount: -5 },
    { isSlip: true, amount: "50" },
    { isSlip: true, amount: 2_000_000_000 },
    null,
    "50",
  ])("rejects %j", (value) => {
    expect(toSlipReading(value, today)).toBeNull();
  });
});

describe("isSlipOcrConfigured", () => {
  it("needs a non-empty key", () => {
    expect(isSlipOcrConfigured({ GEMINI_API_KEY: "k" })).toBe(true);
    expect(isSlipOcrConfigured({ GEMINI_API_KEY: " " })).toBe(false);
    expect(isSlipOcrConfigured({})).toBe(false);
  });
});
