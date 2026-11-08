import { describe, expect, it } from "vitest";
import {
  buildPaidKeyboard,
  buildReminderText,
  decodePaidCallback,
  encodePaidCallback,
  paidConfirmation,
} from "@/lib/telegram-reminder";

const SUB_ID = "cmh7k2x9b0000abcd1234efgh";

const base = {
  subscriptionId: SUB_ID,
  name: "Netflix",
  amount: 419,
  currency: "THB",
  dueDate: "2026-11-15",
  chargeTime: null,
  intervalCount: 1,
  intervalUnit: "MONTH" as const,
  paymentMethod: null,
  daysBefore: 3,
};

describe("buildReminderText", () => {
  it("names the subscription, amount, due date and cycle", () => {
    const text = buildReminderText(base);
    expect(text).toContain("เตือนชำระ Netflix อีก 3 วัน");
    expect(text).toContain("ยอด 419.00 บาท");
    expect(text).toContain("รอบบิล ทุก 1 เดือน");
    expect(text).not.toContain("วิธีชำระ");
  });

  it("says tomorrow for one day and adds charge time and payment method", () => {
    const text = buildReminderText({ ...base, daysBefore: 1, chargeTime: "09:30", paymentMethod: "บัตร\nKBank", currency: "USD" });
    expect(text).toContain("พรุ่งนี้");
    expect(text).toMatch(/ครบกำหนด .+ 09:30/);
    expect(text).toContain("วิธีชำระ บัตร KBank");
    expect(text).toContain("419.00 USD");
  });
});

describe("paid callback", () => {
  it("round-trips the subscription and due date within Telegram's 64-byte limit", () => {
    const data = encodePaidCallback(SUB_ID, "2026-11-15");
    expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
    expect(decodePaidCallback(data)).toEqual({ subscriptionId: SUB_ID, dueDate: "2026-11-15" });
    expect(buildPaidKeyboard(SUB_ID, "2026-11-15").inline_keyboard[0][0]).toEqual({ text: "จ่ายแล้ว", callback_data: data });
  });

  it("rejects other callback data", () => {
    expect(decodePaidCallback(`del:${SUB_ID}`)).toBeNull();
    expect(decodePaidCallback(`paid:${SUB_ID}:2026-11-15`)).toBeNull();
    expect(decodePaidCallback("paid:x:20261115")).toBeNull();
  });

  it("confirms the payment and the next due date", () => {
    expect(paidConfirmation({ name: "Netflix", amount: 419, currency: "THB", nextDueDate: "2026-12-15" }))
      .toMatch(/^บันทึกการจ่าย Netflix 419.00 บาท แล้ว\nรอบถัดไป /);
  });
});
