import { describe, expect, it } from "vitest";
import {
  buildCategoryKeyboard,
  decodeCategoryCallback,
  encodeCategoryCallback,
  formatBaht,
  formatDaySummary,
  formatMonthSummary,
  parseCommand,
  parseExpenseText,
  pickImage,
} from "@/lib/telegram-parse";

describe("parseExpenseText", () => {
  it.each([
    ["ข้าว 60", 60, "ข้าว"],
    ["60 กาแฟ", 60, "กาแฟ"],
    ["55.50", 55.5, null],
    ["ค่าเช่า 1,200", 1200, "ค่าเช่า"],
    ["ข้าว 2 จาน 60", 60, "ข้าว 2 จาน"],
    ["60 บาท ข้าว", 60, "ข้าว"],
    ["ข้าว 60 บาท", 60, "ข้าว"],
    ["฿1,200.50", 1200.5, null],
    ["๖๐ ข้าว", 60, "ข้าว"],
    ["ข้าวมันไก่60", 60, "ข้าวมันไก่"],
    ["ค่าไฟ 350 บ.", 350, "ค่าไฟ"],
  ])("reads %s", (text, amount, note) => {
    expect(parseExpenseText(text)).toEqual({ amount, note });
  });

  it("prefers the number at the end", () => {
    expect(parseExpenseText("60 กาแฟ 2")).toEqual({ amount: 2, note: "60 กาแฟ" });
  });

  it.each(["ข้าว", "0", "1e3", "12.345", "/today", "", "1,20", "abc60", "1000000001"])("rejects %s", (text) => {
    expect(parseExpenseText(text)).toBeNull();
  });

  it("cuts a long note to 200 characters", () => {
    expect(parseExpenseText(`${"ก".repeat(250)} 60`)?.note).toHaveLength(200);
  });
});

describe("parseCommand", () => {
  it("reads commands with or without the bot name", () => {
    expect(parseCommand("/today")).toBe("today");
    expect(parseCommand("/Month@subtrack_bot")).toBe("month");
    expect(parseCommand("/undo please")).toBe("undo");
    expect(parseCommand("/todayx")).toBeNull();
    expect(parseCommand("today")).toBeNull();
  });
});

describe("category callbacks", () => {
  const id = "cmh7k2x9b0000abcd1234efgh";

  it("round-trips and fits Telegram's 64-byte limit", () => {
    const data = encodeCategoryCallback(id, "transport");
    expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(64);
    expect(decodeCategoryCallback(data)).toEqual({ expenseId: id, key: "transport" });
  });

  it("rejects unknown keys and malformed data", () => {
    expect(decodeCategoryCallback(`cat:${id}:nope`)).toBeNull();
    expect(decodeCategoryCallback(`cat:short:food`)).toBeNull();
    expect(decodeCategoryCallback("anything")).toBeNull();
  });

  it("lays the categories out four per row", () => {
    const rows = buildCategoryKeyboard(id).inline_keyboard;
    expect(rows.map((row) => row.length)).toEqual([4, 3]);
    expect(rows[0][0]).toEqual({ text: "อาหาร", callback_data: `cat:${id}:food` });
  });
});

describe("pickImage", () => {
  const chat = { id: 1, type: "private" };

  it("takes the largest photo", () => {
    const image = pickImage({
      message_id: 1,
      chat,
      photo: [
        { file_id: "small", width: 90, height: 160, file_size: 1000 },
        { file_id: "large", width: 720, height: 1280, file_size: 90000 },
      ],
    });
    expect(image).toEqual({ fileId: "large", fileSize: 90000, fileName: null });
  });

  it("accepts an image sent as a file and ignores other files", () => {
    expect(pickImage({ message_id: 1, chat, document: { file_id: "doc", mime_type: "image/png", file_name: "slip.png" } }))
      .toEqual({ fileId: "doc", fileSize: null, fileName: "slip.png" });
    expect(pickImage({ message_id: 1, chat, document: { file_id: "pdf", mime_type: "application/pdf" } })).toBeNull();
  });
});

describe("summaries", () => {
  it("formats baht with two decimals", () => {
    expect(formatBaht(1284.5)).toBe("1,284.50");
  });

  it("lists the day's items with a total", () => {
    const text = formatDaySummary("2026-11-07", [
      { time: "08:15", title: "ข้าว", category: "อาหาร", amount: 60, currency: "THB" },
      { time: null, title: null, category: "อื่นๆ", amount: 40.5, currency: "THB" },
    ]);
    expect(text).toContain("• 08:15 · ข้าว · อาหาร · 60.00 บาท");
    expect(text).toContain("• --:-- · ไม่ระบุ · อื่นๆ · 40.50 บาท");
    expect(text).toContain("รวม 100.50 บาท");
  });

  it("says when the day is empty", () => {
    expect(formatDaySummary("2026-11-07", [])).toContain("ยังไม่มีรายการ");
  });

  it("totals the month by category, largest first, with subscriptions apart", () => {
    const text = formatMonthSummary(
      "2026-11",
      [
        { category: "อาหาร", amount: 60, currency: "THB" },
        { category: "เดินทาง", amount: 300, currency: "THB" },
        { category: "อาหาร", amount: 45, currency: "THB" },
      ],
      [{ amount: 149, currency: "THB" }],
    );
    const lines = text.split("\n");
    expect(lines[1]).toBe("• เดินทาง 300.00 บาท");
    expect(lines[2]).toBe("• อาหาร 105.00 บาท");
    expect(text).toContain("ค่าใช้จ่าย 3 รายการ รวม 405.00 บาท");
    expect(text).toContain("Subscription ที่จ่ายแล้ว 149.00 บาท");
  });
});
