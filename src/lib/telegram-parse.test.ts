import { describe, expect, it } from "vitest";
import {
  buildCategoryKeyboard,
  buildDeletePicker,
  decodeCategoryCallback,
  decodeDeleteCallback,
  describeExpense,
  encodeCategoryCallback,
  encodeDeleteCallback,
  formatBaht,
  formatDaySummary,
  formatMonthSummary,
  parseCommand,
  parseEntry,
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

describe("parseEntry", () => {
  const today = "2026-11-09";

  it("uses today when there is no date", () => {
    expect(parseEntry("ข้าว 60", today)).toEqual({ ok: true, expense: { amount: 60, note: "ข้าว", date: today } });
  });

  it.each([
    ["8/11/2569 อาหาร 50", "2026-11-08", 50, "อาหาร"],
    ["8/11/2026 อาหาร 50", "2026-11-08", 50, "อาหาร"],
    ["8/11/69 อาหาร 50", "2026-11-08", 50, "อาหาร"],
    ["8/11/26 อาหาร 50", "2026-11-08", 50, "อาหาร"],
    ["8-11-2569 50 อาหาร", "2026-11-08", 50, "อาหาร"],
    ["๘/๑๑/๒๕๖๙ อาหาร ๕๐", "2026-11-08", 50, "อาหาร"],
    ["1/11 ข้าว 60", "2026-11-01", 60, "ข้าว"],
    ["30/12 ของขวัญ 500", "2025-12-30", 500, "ของขวัญ"],
    ["8/11 120", "2026-11-08", 120, null],
    ["เมื่อวาน กาแฟ 45", "2026-11-08", 45, "กาแฟ"],
    ["เมื่อวานนี้ กาแฟ 45", "2026-11-08", 45, "กาแฟ"],
    ["เมื่อวาน 45 กาแฟ", "2026-11-08", 45, "กาแฟ"],
    ["กาแฟ เมื่อวาน 45", "2026-11-08", 45, "กาแฟ"],
    ["ข้าว 60 เมื่อวาน", "2026-11-08", 60, "ข้าว"],
    ["ข้าวเมื่อวาน 60", "2026-11-08", 60, "ข้าว"],
    ["วานนี้ ข้าว 60", "2026-11-08", 60, "ข้าว"],
    ["เมื่อวาน 60", "2026-11-08", 60, null],
    ["วานซืน ข้าว 60", "2026-11-07", 60, "ข้าว"],
    ["กาแฟ เมื่อวานซืน 45", "2026-11-07", 45, "กาแฟ"],
    ["9/11/2569 ข้าว 60", "2026-11-09", 60, "ข้าว"],
  ])("reads %s", (text, date, amount, note) => {
    expect(parseEntry(text, today)).toEqual({ ok: true, expense: { amount, note, date } });
  });

  it("keeps a decimal amount at the start as an amount", () => {
    expect(parseEntry("12.5 ข้าว", today)).toEqual({ ok: true, expense: { amount: 12.5, note: "ข้าว", date: today } });
  });

  it("goes back across a new year for yesterday", () => {
    expect(parseEntry("เมื่อวาน ข้าว 60", "2026-01-01")).toMatchObject({ ok: true, expense: { date: "2025-12-31" } });
  });

  it("needs an amount with a relative day", () => {
    expect(parseEntry("เมื่อวาน ข้าว", today)).toMatchObject({ ok: false });
  });

  it.each([
    ["31/2/2569 ข้าว 60", "ไม่มีวันที่"],
    ["10/11/2569 ข้าว 60", "อนาคต"],
    ["1/1/1990 ข้าว 60", "เก่าเกินไป"],
    ["8/11/2569 ข้าว", "ใส่ยอดเงิน"],
  ])("explains why %s cannot be used", (text, error) => {
    const result = parseEntry(text, today);
    expect(result).toMatchObject({ ok: false });
    expect(result && !result.ok && result.error).toContain(error);
  });

  it("returns null for text that is not an entry", () => {
    expect(parseEntry("สวัสดี", today)).toBeNull();
    expect(parseEntry("/today", today)).toBeNull();
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
    const data = encodeCategoryCallback(id, "fuel");
    expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(64);
    expect(decodeCategoryCallback(data)).toEqual({ expenseId: id, key: "fuel" });
  });

  it("rejects unknown keys and malformed data", () => {
    expect(decodeCategoryCallback(`cat:${id}:nope`)).toBeNull();
    expect(decodeCategoryCallback(`cat:short:food`)).toBeNull();
    expect(decodeCategoryCallback("anything")).toBeNull();
  });

  it("lays the categories out four per row", () => {
    const rows = buildCategoryKeyboard(id).inline_keyboard;
    expect(rows.map((row) => row.length)).toEqual([4, 4, 4]);
    expect(rows[0][0]).toEqual({ text: "ค่ากิน", callback_data: `cat:${id}:food` });
  });
});

describe("delete callbacks", () => {
  const id = "cmh7k2x9b0000abcd1234efgh";

  it("round-trips each action within 64 bytes", () => {
    for (const callback of [
      { action: "pick", expenseId: id },
      { action: "confirm", expenseId: id },
      { action: "cancel" },
    ] as const) {
      const data = encodeDeleteCallback(callback);
      expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(64);
      expect(decodeDeleteCallback(data)).toEqual(callback);
    }
  });

  it("does not mistake category callbacks or junk for deletes", () => {
    expect(decodeDeleteCallback(`cat:${id}:food`)).toBeNull();
    expect(decodeDeleteCallback("del:short")).toBeNull();
    expect(decodeDeleteCallback("delok:")).toBeNull();
  });

  it("describes an entry, adding the date only when it is not today", () => {
    const entry = { id, paidDate: "2026-11-07", paidTime: "12:30", title: "ข้าว", amount: 60, hasImage: false };
    expect(describeExpense(entry, "2026-11-07")).toBe("12:30 · ข้าว · 60.00 บาท");
    expect(describeExpense({ ...entry, hasImage: true }, "2026-11-08")).toBe("7 พ.ย. 12:30 · ข้าว · 60.00 บาท · มีรูป");
    expect(describeExpense({ ...entry, title: "ก".repeat(30) }, "2026-11-07")).toContain("…");
  });

  it("builds one button per entry plus a close button", () => {
    const entry = { id, paidDate: "2026-11-07", paidTime: null, title: null, amount: 45, hasImage: false };
    const rows = buildDeletePicker([entry, { ...entry, id: "cmh7k2x9b0000abcd1234zzzz" }], "2026-11-07").inline_keyboard;
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toEqual({ text: "ไม่ระบุ · 45.00 บาท", callback_data: `del:${id}` });
    expect(rows[2][0].callback_data).toBe("delno");
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

describe("edit helpers", () => {
  const ID = "cmh7k2x9b0000abcd1234efgh";
  it("round-trips edit callbacks", async () => {
    const { decodeEditCallback, encodeEditCallback } = await import("@/lib/telegram-parse");
    expect(decodeEditCallback(encodeEditCallback({ action: "pick", expenseId: ID }))).toEqual({ action: "pick", expenseId: ID });
    expect(decodeEditCallback("editno")).toEqual({ action: "cancel" });
    expect(decodeEditCallback(`del:${ID}`)).toBeNull();
  });

  it("finds the entry id only in an edit prompt", async () => {
    const { buildEditPrompt, editPromptExpenseId } = await import("@/lib/telegram-parse");
    expect(editPromptExpenseId(buildEditPrompt("กาแฟ · 45.00 บาท", ID))).toBe(ID);
    expect(editPromptExpenseId("บันทึก 45.00 บาท")).toBeNull();
    expect(editPromptExpenseId(undefined)).toBeNull();
  });

  it("reads an amount alone", async () => {
    const { parseEditAmount } = await import("@/lib/telegram-parse");
    expect(parseEditAmount("55")).toBe(55);
    expect(parseEditAmount("1,250.50 บาท")).toBe(1250.5);
    expect(parseEditAmount("๕๕")).toBe(55);
    expect(parseEditAmount("กาแฟ 55")).toBeNull();
    expect(parseEditAmount("abc")).toBeNull();
  });
});
